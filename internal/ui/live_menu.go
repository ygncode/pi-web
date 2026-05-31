package ui

import (
	_ "embed"
	"html/template"
	"strings"
)

//go:embed live_templates/menu.html
var liveMenuTmplStr string

var liveMenuTmpl = template.Must(template.New("live_menu").Parse(liveMenuTmplStr))

type liveMenuData struct {
	ID                string
	Class             string
	ContainerAttrs    template.HTMLAttr
	BodyClass         string
	SectionClass      string
	SectionTitleClass string
	ItemClass         string
	Sections          []liveMenuSection
}

type liveMenuSection struct {
	Title string
	Items []liveMenuItem
}

type liveMenuItem struct {
	Label      template.HTML
	Suffix     template.HTML
	Href       string
	Muted      bool
	ExtraClass string
	Attrs      template.HTMLAttr
}

func renderLiveMenu(data liveMenuData) template.HTML {
	var b strings.Builder
	if err := liveMenuTmpl.Execute(&b, data); err != nil {
		panic(err)
	}
	return template.HTML(b.String())
}

func homeMenuHTML() template.HTML {
	return renderLiveMenu(liveMenuData{
		ID:                "web-menu",
		Class:             "web-menu",
		ContainerAttrs:    `role="menu" aria-labelledby="web-menu-btn" hidden`,
		SectionClass:      "web-menu-section",
		SectionTitleClass: "web-menu-section-title",
		ItemClass:         "web-menu-item",
		Sections: []liveMenuSection{
			{Items: []liveMenuItem{
				{Label: "New Session", Attrs: `data-new-session-btn role="menuitem"`},
				{Label: "Import Session", Muted: true, Attrs: `role="menuitem"`},
			}},
			{Items: []liveMenuItem{
				{Label: "<span>Appearance</span>", Suffix: "<span data-theme-icon>◐</span>", Attrs: `id="theme-toggle" role="menuitem"`},
				{Label: "<span>Notifications</span>", Suffix: `<span id="index-notify-status">OFF</span><select class="sound-selector" style="display: none;" data-action="select-sound"></select>`, Attrs: `id="index-notify-toggle" role="menuitem" aria-pressed="false"`},
				{Label: "<span>Spinner</span>", Suffix: `<span id="index-spinner-status">RUNCAT</span>`, Attrs: `id="index-spinner-toggle" role="menuitem" aria-pressed="false"`},
			}},
			{Items: []liveMenuItem{
				{Label: "Active Sessions", Muted: true, Attrs: `role="menuitem"`},
				{Label: "Archived Sessions", Muted: true, Attrs: `role="menuitem"`},
			}},
			{Items: []liveMenuItem{
				{Label: "Documentation", Href: "https://github.com/ygncode/pi-web/tree/main/docs", Attrs: `target="_blank" rel="noreferrer" role="menuitem"`},
				{Label: "GitHub", Href: "https://github.com/ygncode/pi-web", Attrs: `target="_blank" rel="noreferrer" role="menuitem"`},
			}},
			{Items: []liveMenuItem{
				{
					Label:  "<span>Version</span>",
					Suffix: `<span class="version-status" data-version-status>…</span>`,
					Attrs:  `id="index-version-row" data-version-row role="menuitem"`,
				},
				{Label: "<span>Settings</span>", Suffix: "<span>›</span>", Muted: true, Attrs: `role="menuitem"`},
			}},
		},
	})
}

func sessionMenuHTML(id, class, bodyClass, itemClass, toggleID, themeIconClass, toggleClass, versionStatusID, containerAttrs string) template.HTML {
	return renderLiveMenu(liveMenuData{
		ID:                id,
		Class:             class,
		ContainerAttrs:    template.HTMLAttr(containerAttrs),
		BodyClass:         bodyClass,
		SectionClass:      strings.TrimSuffix(itemClass, "item") + "section",
		SectionTitleClass: strings.TrimSuffix(itemClass, "item") + "section-title",
		ItemClass:         itemClass,
		Sections: []liveMenuSection{
			{Title: "Session", Items: []liveMenuItem{
				{Label: "New Session", Suffix: template.HTML("<kbd>⌘T</kbd>"), Attrs: `data-action="new-session"`},
				{Label: "Search Sessions", Suffix: template.HTML("<kbd>⌘K</kbd>"), Attrs: `data-action="list-sessions"`},
			}},
			{Items: []liveMenuItem{
				{Label: "Rename", Attrs: `data-action="rename"`},
				{Label: "Share", Attrs: `data-action="share"`},
				{Label: "Fork", Attrs: `data-action="fork"`},
				{Label: "Clone", Attrs: `data-action="clone"`},
			}},
			{Title: "Preferences", Items: []liveMenuItem{
				{Label: "<span>Appearance</span>", Suffix: template.HTML("<span class=\"" + themeIconClass + "\" data-command-theme-icon>◐</span>"), Attrs: `data-action="theme"`},
				{Label: "<span>Notifications</span>", Suffix: template.HTML("<span class=\"" + toggleClass + "\" id=\"" + toggleID + "\">OFF</span><select class=\"sound-selector\" style=\"display: none;\" data-action=\"select-sound\"></select>"), ExtraClass: itemClass + "-toggle", Attrs: `data-action="notifications"`},
				{Label: "<span>Spinner</span>", Suffix: template.HTML("<span class=\"" + toggleClass + "\" id=\"" + strings.Replace(toggleID, "notify", "spinner", 1) + "\">RUNCAT</span>"), ExtraClass: itemClass + "-toggle", Attrs: `data-action="spinner"`},
			}},
			{Title: "Development", Items: []liveMenuItem{
				{Label: "Resume via Terminal", Attrs: `data-action="terminal"`},
				{Label: "Tree", Suffix: template.HTML("<kbd>⌘B</kbd>"), Attrs: `data-action="tree"`},
				{Label: "Diff", Attrs: `data-action="diff"`},
			}},
			{Title: "Insights", Items: []liveMenuItem{
				{Label: "Model Usage", Attrs: `data-action="model-usage"`},
			}},
			{Title: "Resources", Items: []liveMenuItem{
				{Label: "Documentation", Href: "https://github.com/ygncode/pi-web/tree/main/docs", Attrs: `target="_blank" rel="noreferrer" role="menuitem"`},
				{Label: "GitHub", Href: "https://github.com/ygncode/pi-web", Attrs: `target="_blank" rel="noreferrer" role="menuitem"`},
			}},
			{Items: []liveMenuItem{
				{
					Label:  "<span>Version</span>",
					Suffix: template.HTML("<span class=\"version-status\" id=\"" + versionStatusID + "\" data-version-status>…</span>"),
					Attrs:  `data-action="version" data-version-row role="menuitem"`,
				},
				{Label: "<span>Settings</span>", Suffix: "<span>›</span>", Muted: true, Attrs: `role="menuitem"`},
			}},
		},
	})
}

func sessionDesktopMenuHTML() template.HTML {
	return sessionMenuHTML(
		"command-menu-popover",
		"command-menu-popover",
		"command-menu-body",
		"command-menu-item",
		"command-menu-notify-status",
		"command-menu-theme-icon",
		"command-menu-toggle",
		"command-menu-version-status",
		`role="menu" aria-labelledby="command-menu-btn" style="display: none;"`,
	)
}

func sessionMobileMenuHTML() template.HTML {
	return sessionMenuHTML(
		"mobile-command-panel",
		"mobile-command-panel",
		"mobile-command-body",
		"mobile-command-item",
		"mobile-command-notify-status",
		"mobile-command-theme-icon",
		"mobile-command-toggle",
		"mobile-command-version-status",
		`style="display: none;"`,
	)
}
