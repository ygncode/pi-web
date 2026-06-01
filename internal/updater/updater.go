// Package updater checks whether a newer pi-web release is available. It
// compares the build-time version against the npm registry's published
// version (the install channel) and fetches the matching changelog from the
// GitHub Releases API. Results are cached in memory and refreshed by a
// background poll; callers can also force an immediate check.
package updater

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	defaultNPMURL    = "https://registry.npmjs.org/@ygncode/pi-web"
	defaultGitHubAPI = "https://api.github.com/repos/ygncode/pi-web"
	// npmChannel is the dist-tag pi-web installs from (see pi install command).
	npmChannel = "beta"
	// PollInterval is how often the background goroutine refreshes the cache.
	PollInterval = 6 * time.Hour
	httpTimeout  = 10 * time.Second
)

// Info is the snapshot returned to the API layer (and marshalled to JSON).
type Info struct {
	Current      string `json:"current"`
	Latest       string `json:"latest"`
	HasUpdate    bool   `json:"hasUpdate"`
	IsDev        bool   `json:"isDev"`
	Changelog    string `json:"changelog"`
	ChangelogURL string `json:"changelogUrl"`
	CheckedAt    string `json:"checkedAt"`
}

// devVersionRe matches `git describe` development builds: a tag followed by a
// commits-ahead count and an abbreviated SHA (e.g. "-3-gd7e8bf2"), optionally
// "-dirty". Clean release builds are exactly the tag and don't match.
var devVersionRe = regexp.MustCompile(`-\d+-g[0-9a-f]{7,}|-dirty$`)

// Checker holds the current version and the cached result of the last remote
// check. It is safe for concurrent use.
type Checker struct {
	current   string
	npmURL    string
	githubAPI string
	client    *http.Client

	mu           sync.RWMutex
	latest       string
	changelog    string
	changelogURL string
	checkedAt    time.Time
}

// New builds a Checker for the given build-time version. version "dev" (or
// empty) disables remote checks — Info always reports no update available.
func New(version string) *Checker {
	if version == "" {
		version = "dev"
	}
	return &Checker{
		current:   version,
		npmURL:    defaultNPMURL,
		githubAPI: defaultGitHubAPI,
		client:    &http.Client{Timeout: httpTimeout},
	}
}

// isDev reports whether the current build is a local/dev build that should
// never be compared against published releases. This covers the literal "dev"
// sentinel as well as `git describe` builds that are ahead of a tag or dirty —
// updating those would silently downgrade local work to the published release.
func (c *Checker) isDev() bool {
	return c.current == "" || c.current == "dev" || devVersionRe.MatchString(c.current)
}

// Info returns the current cached snapshot without making network calls.
func (c *Checker) Info() Info {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.snapshotLocked()
}

func (c *Checker) snapshotLocked() Info {
	info := Info{
		Current:      c.current,
		Latest:       c.latest,
		IsDev:        c.isDev(),
		Changelog:    c.changelog,
		ChangelogURL: c.changelogURL,
	}
	if !c.checkedAt.IsZero() {
		info.CheckedAt = c.checkedAt.UTC().Format(time.RFC3339)
	}
	if !c.isDev() && c.latest != "" {
		info.HasUpdate = compareSemver(c.latest, c.current) > 0
	}
	return info
}

// Check performs a fresh remote fetch and updates the cache. It returns the
// resulting snapshot. For dev builds it short-circuits and only stamps
// checkedAt so the UI can show "checked just now".
func (c *Checker) Check(ctx context.Context) (Info, error) {
	if c.isDev() {
		c.mu.Lock()
		c.checkedAt = time.Now()
		info := c.snapshotLocked()
		c.mu.Unlock()
		return info, nil
	}

	latest, err := c.fetchLatestVersion(ctx)
	if err != nil {
		return c.Info(), err
	}

	var changelog, changelogURL string
	if compareSemver(latest, c.current) > 0 {
		changelog, changelogURL = c.fetchChangelog(ctx, latest)
	}

	c.mu.Lock()
	c.latest = latest
	if changelog != "" || changelogURL != "" {
		c.changelog = changelog
		c.changelogURL = changelogURL
	}
	c.checkedAt = time.Now()
	info := c.snapshotLocked()
	c.mu.Unlock()
	return info, nil
}

// Start runs an initial check shortly after launch, then refreshes every
// PollInterval until ctx is cancelled. Intended to be run in its own goroutine.
func (c *Checker) Start(ctx context.Context) {
	if c.isDev() {
		return
	}
	// Small delay so startup isn't blocked on the network.
	timer := time.NewTimer(3 * time.Second)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			checkCtx, cancel := context.WithTimeout(ctx, httpTimeout*2)
			_, _ = c.Check(checkCtx)
			cancel()
			timer.Reset(PollInterval)
		}
	}
}

// fetchLatestVersion reads the published version for the install channel from
// the npm registry packument (dist-tags), falling back to "latest".
func (c *Checker) fetchLatestVersion(ctx context.Context) (string, error) {
	body, err := c.get(ctx, c.npmURL, "")
	if err != nil {
		return "", err
	}
	var doc struct {
		DistTags map[string]string `json:"dist-tags"`
	}
	if err := json.Unmarshal(body, &doc); err != nil {
		return "", fmt.Errorf("parse npm packument: %w", err)
	}
	if v := doc.DistTags[npmChannel]; v != "" {
		return v, nil
	}
	if v := doc.DistTags["latest"]; v != "" {
		return v, nil
	}
	return "", fmt.Errorf("no published version found for @ygncode/pi-web")
}

// fetchChangelog tries the version-specific GitHub release first, then the
// generic "latest release". Failures are non-fatal — an empty changelog just
// means the UI shows the update without release notes.
func (c *Checker) fetchChangelog(ctx context.Context, version string) (body, url string) {
	tag := "v" + strings.TrimPrefix(version, "v")
	if rel, err := c.fetchRelease(ctx, c.githubAPI+"/releases/tags/"+tag); err == nil {
		return rel.Body, rel.HTMLURL
	}
	if rel, err := c.fetchRelease(ctx, c.githubAPI+"/releases/latest"); err == nil {
		return rel.Body, rel.HTMLURL
	}
	return "", ""
}

type githubRelease struct {
	Body    string `json:"body"`
	HTMLURL string `json:"html_url"`
}

func (c *Checker) fetchRelease(ctx context.Context, url string) (githubRelease, error) {
	var rel githubRelease
	body, err := c.get(ctx, url, githubToken())
	if err != nil {
		return rel, err
	}
	if err := json.Unmarshal(body, &rel); err != nil {
		return rel, err
	}
	return rel, nil
}

func (c *Checker) get(ctx context.Context, url, bearer string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "pi-web-updater")
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("GET %s: HTTP %d", url, resp.StatusCode)
	}
	return body, nil
}

func githubToken() string {
	return os.Getenv("GITHUB_TOKEN")
}

// compareSemver compares two semver strings (optionally "v"-prefixed, with an
// optional prerelease suffix like "-beta.24"). It returns -1, 0, or 1.
// A release version outranks any prerelease with the same core (per semver).
func compareSemver(a, b string) int {
	coreA, preA := splitVersion(a)
	coreB, preB := splitVersion(b)

	for i := 0; i < 3; i++ {
		if coreA[i] != coreB[i] {
			if coreA[i] < coreB[i] {
				return -1
			}
			return 1
		}
	}
	return comparePrerelease(preA, preB)
}

// splitVersion parses "v1.2.3-beta.4" into [1,2,3] and "beta.4". Missing
// numeric parts default to 0; unparseable parts are treated as 0.
func splitVersion(v string) ([3]int, string) {
	v = strings.TrimSpace(v)
	v = strings.TrimPrefix(v, "v")
	core := v
	pre := ""
	if i := strings.IndexByte(v, '-'); i >= 0 {
		core = v[:i]
		pre = v[i+1:]
	}
	// Drop build metadata.
	if i := strings.IndexByte(core, '+'); i >= 0 {
		core = core[:i]
	}
	if i := strings.IndexByte(pre, '+'); i >= 0 {
		pre = pre[:i]
	}
	var nums [3]int
	for i, part := range strings.SplitN(core, ".", 3) {
		if i > 2 {
			break
		}
		nums[i], _ = strconv.Atoi(strings.TrimSpace(part))
	}
	return nums, pre
}

// comparePrerelease implements semver prerelease precedence: no prerelease
// outranks a prerelease; otherwise dot-separated identifiers are compared,
// numeric < non-numeric, numerics compared as integers.
func comparePrerelease(a, b string) int {
	if a == b {
		return 0
	}
	if a == "" {
		return 1 // release > prerelease
	}
	if b == "" {
		return -1
	}
	pa := strings.Split(a, ".")
	pb := strings.Split(b, ".")
	for i := 0; i < len(pa) && i < len(pb); i++ {
		if c := compareIdentifier(pa[i], pb[i]); c != 0 {
			return c
		}
	}
	switch {
	case len(pa) < len(pb):
		return -1
	case len(pa) > len(pb):
		return 1
	default:
		return 0
	}
}

func compareIdentifier(a, b string) int {
	na, errA := strconv.Atoi(a)
	nb, errB := strconv.Atoi(b)
	bothNumeric := errA == nil && errB == nil
	switch {
	case bothNumeric:
		switch {
		case na < nb:
			return -1
		case na > nb:
			return 1
		default:
			return 0
		}
	case errA == nil: // numeric < non-numeric
		return -1
	case errB == nil:
		return 1
	default:
		return strings.Compare(a, b)
	}
}
