<h1 align="center">pi-web (Remote Control Your Pi)</h1>

<div align="center">

[![GitHub stars](https://img.shields.io/github/stars/ygncode/pi-web?style=flat&logo=github&label=stars&cacheSeconds=86400)](https://github.com/ygncode/pi-web/stargazers)
[![npm downloads](https://img.shields.io/npm/dw/@ygncode/pi-web?label=downloads/wk&color=2ea043&cacheSeconds=86400)](https://www.npmjs.com/package/@ygncode/pi-web)
[![license MIT](https://img.shields.io/npm/l/@ygncode/pi-web?label=license&color=0a7bbb&cacheSeconds=86400)](../../LICENSE)
[![Telegram](https://img.shields.io/badge/Telegram-Join-26A5E4?logo=telegram&logoColor=white)](https://t.me/+NJvFOTTa0wNjNTc9)
![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-555)

[English](../../README.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [Bahasa Indonesia](README.id.md) · [Bahasa Melayu](README.ms.md) · [Tiếng Việt](README.vi.md) · [ไทย](README.th.md) · [Filipino](README.fil.md) · [မြန်မာ](README.my.md) · **ភាសាខ្មែរ** · [ລາວ](README.lo.md)

</div>

<div align="center">

បើកបរភ្នាក់ងារសរសេរកូដ [pi](https://pi.dev) របស់អ្នកពីទូរសព្ទ ថេប្លេត ឬកុំព្យូទ័រយួរដៃ — គ្រប់ទីកន្លែងនៅលើបណ្តាញរបស់អ្នក ឬពីចម្ងាយតាមរយៈ Tailscale។

វាជា PWA ពេញលេញ ដូច្នេះអ្នកអាចដំឡើងវា និងប្រើវាដូចជាកម្មវិធីដើមនៅលើឧបករណ៍ណាមួយ។ គិតថាវាជាកន្លែងធ្វើការ AI ផ្ទាល់ខ្លួនរបស់អ្នក — ដូចជា Cowork របស់ Claude ប៉ុន្តែមានម៉ូដែលផ្សេងៗ — ជជែកឆ្លងម៉ូដែល សរសេរកូដពីទូរសព្ទរបស់អ្នក ឬប្រែក្លាយវាទៅជា[ជំនួយការផ្ទាល់ខ្លួន](user-docs/en/personal-assistant.md)ដែលរស់នៅលើម៉ាស៊ីនរបស់អ្នក។

ធ្វើឱ្យវាក្លាយជារបស់អ្នក៖ ប្តូរស្បែក និងពុម្ពអក្សរ ហើយប្រើវាជាភាសារបស់អ្នកផ្ទាល់ — pi-web ភ្ជាប់មកជាមួយភាសាច្រើន ហើយអ្នកអាចបន្ថែមភាសាផ្ទាល់ខ្លួនរបស់អ្នកបាន។ មុខងារជាច្រើនទៀតកំពុងមកដល់ ប៉ុន្តែវានឹងមិនធ្វើឱ្យធុញទេ៖ អ្វីដែលអ្នកមិនត្រូវការ អាចបិទបាននៅក្នុងការកំណត់។

</div>

> [!WARNING]
> pi-web បច្ចុប្បន្នស្ថិតក្នុងដំណាក់កាល **beta**។ អ្វីៗនឹងផ្លាស់ប្តូរ និងខូច!

> [!TIP]
> ថ្មីនៅទីនេះ? **[អានការណែនាំអ្នកប្រើ →](user-docs/en/README.md)** សម្រាប់ដំណើរទស្សនាពេញលេញនៃមុខងារ ជំហានដំឡើង និងគន្លឹះនានា។ ([ភាសាផ្សេងទៀត →](../README.md))

## រូបថតអេក្រង់

<div align="center">
  <img src="../assets/pi-web-desktop-screenshot.png" alt="Desktop" width="90%" /><br />
  <em>កុំព្យូទ័រលើតុ</em>
  <br /><br />
  <img src="../assets/pi-web-mobile-screenshot.png" alt="Mobile PWA" width="90%" /><br />
  <em>ទូរសព្ទ PWA</em>
</div>

## របៀបដែលវាភ្ជាប់គ្នា

```
 pi (terminal)                 Browser (phone / tablet / laptop)
      │                                │
      │  writes JSONL                  │  HTTP + SSE
      ▼                                ▼
 ~/.pi/agent/sessions/  ←───  pi-web (Go HTTP server)
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
              pi --mode rpc      fsnotify         tailscale serve
            (per‑session       (live reload)      (remote HTTPS
             chat worker)                           via MagicDNS)
```

- **pi** សរសេរ JSONL ការសន្ទនាទៅកាន់ `~/.pi/agent/sessions/` នៅពេលវាដំណើរការ។
- **pi-web** គឺជាម៉ាស៊ីនបម្រើ Go ដែលអានឯកសារទាំងនោះ បង្ហាញពួកវានៅក្នុងកម្មវិធីរុករក និងផ្សាយបន្តផ្ទាល់នូវការធ្វើបច្ចុប្បន្នភាពតាមរយៈ SSE។
- **pi --mode rpc** កម្មករគ្រប់គ្រងការជជែកដែលផ្តួចផ្តើមដោយកម្មវិធីរុករក — មួយក្នុងមួយសម័យ បិទបន្ទាប់ពីទំនេរ ១០ នាទី។
- **fsnotify** ឃ្លាំមើលថតសម័យ ដូច្នេះកម្មវិធីរុករកផ្ទុកឡើងវិញក្នុងរយៈពេលមីលីវិនាទីនៃលទ្ធផលថ្មី។
- **Tailscale Serve** ផ្សព្វផ្សាយម៉ាស៊ីនបម្រើ localhost ជាចំណុចបញ្ចប់ HTTPS នៅលើ tailnet របស់អ្នក។

## ដំឡើង

```bash
pi install npm:@ygncode/pi-web@beta
```

នោះហើយជាវា — វាទាញយក binary ដែលត្រូវគ្នា រៀបចំការចាប់ផ្តើមដោយស្វ័យប្រវត្តិ និងចុះឈ្មោះពាក្យបញ្ជា `/web`, `/pi-web`, `/remote` និង `/refresh`។

នៅពេលដំឡើងរួច បើក `http://127.0.0.1:31415` នៅក្នុងកម្មវិធីរុករករបស់អ្នក។ ពី pi ប្រើ `/web` ដើម្បីបើកសម័យបច្ចុប្បន្ននៅក្នុងកម្មវិធីរុករករបស់អ្នកភ្លាមៗ។ ប្រសិនបើ Tailscale កំពុងដំណើរការនៅលើម៉ាស៊ីនរបស់អ្នក pi-web នឹងផ្សព្វផ្សាយចំណុចបញ្ចប់ HTTPS ដោយស្វ័យប្រវត្តិនៅលើ tailnet របស់អ្នក — ប្រើ `/remote` ពី pi ដើម្បីទទួលបានកូដ QR និង URL សម្រាប់ឧបករណ៍ណាមួយនៅលើ tailnet របស់អ្នក។

សម្រាប់ការដំឡើងដោយដៃ ការទាញយក binary ឬការបង្កើតពីកូដប្រភព សូមមើល [user-docs/install.md](user-docs/en/install.md)។

## សមាហរណកម្ម Pi

បន្ទាប់ពី `pi install npm:@ygncode/pi-web@beta` អ្នកទទួលបាន៖

| ពាក្យបញ្ជា | អ្វីដែលវាធ្វើ |
|---------|--------------|
| `/web` | បើកសម័យបច្ចុប្បន្ននៅក្នុងកម្មវិធីរុករករបស់អ្នក (យល់ដឹងពី SSH៖ រំលងកម្មវិធីរុករក និងបង្ហាញតែ URL) |
| `/pi-web` | បង្ហាញស្ថានភាព កំណែ ចាប់ផ្តើម/បញ្ឈប់/ចាប់ផ្តើមឡើងវិញម៉ាស៊ីនបម្រើ ឬធ្វើបច្ចុប្បន្នភាព |
| `/remote` | បង្ហាញកូដ QR និង URL សម្រាប់ការចូលប្រើពីចម្ងាយតាមរយៈ Tailscale |
| `/refresh` | ទាញសារថ្មីដែលសរសេរពីកម្មវិធីរុករកពីចម្ងាយ ត្រឡប់ចូលទៅក្នុងសម័យ terminal |

**ការដាក់ចំណងជើងដោយស្វ័យប្រវត្តិ** នៃសម័យត្រូវបានបង្កើតឡើងនៅក្នុង pi-web ផ្ទាល់ និងកំណត់រចនាសម្ព័ន្ធនៅលើទំព័រ `/settings`។ វាត្រូវបាន **បើកតាមលំនាំដើម** និងដាក់ឈ្មោះសម័យដោយស្វ័យប្រវត្តិ។ អ្នកអាចជ្រើសរើស៖

- **ពេលណាត្រូវដាក់ចំណងជើង** — ម្តងក្នុងមួយសម័យ ឬរាល់សារថ្មី (តាមលំនាំដើម)។
- **ម៉ូដែលចំណងជើង** — ឥតគិតថ្លៃ រហ័ស **វិធីពាក្យដែលភ្ជាប់មកជាមួយ (មិនប្រើ AI)** តាមលំនាំដើម ឬជ្រើសរើសម៉ូដែល (ឧ. តូច/លឿន) សម្រាប់ចំណងជើងដែលសរសេរដោយម៉ូដែលឆ្លាតជាង។

កញ្ចប់នេះក៏ដំឡើង binary pi-web ទៅកាន់ `~/.pi/agent/bin/pi-web` និងរៀបចំការចាប់ផ្តើមដោយស្វ័យប្រវត្តិនៅពេលចូលប្រព័ន្ធ។

## ការចាប់ផ្តើមដោយស្វ័យប្រវត្តិនៅពេលចូលប្រព័ន្ធ

ពាក្យបញ្ជា `pi install npm:@ygncode/pi-web@beta` រៀបចំវាដោយស្វ័យប្រវត្តិ៖

| OS | យន្តការ |
|----|-----------|
| macOS | launchd plist នៅ `~/Library/LaunchAgents/com.pi-web.plist` |
| Linux | systemd user service នៅ `~/.config/systemd/user/pi-web.service` |

ដើម្បីកំណត់ token សម្រាប់ការចូលប្រើពីចម្ងាយ បង្កើត `~/.config/pi-web/env`៖

```
PI_WEB_TOKEN=your-token-here
```

សម្រាប់ព័ត៌មានលម្អិតបន្ថែម (ការរៀបចំដោយដៃ ច្រកផ្ទាល់ខ្លួន ការភ្ជាប់មិនមែន loopback) សូមមើល [user-docs/install.md](user-docs/en/install.md)។

## ការអភិវឌ្ឍ

```bash
make setup   # ដំឡើង frontend deps និងទាញយក Go modules
make check   # frontend test/build + Go test/vet
make build   # setup បើចាំបាច់ បង្កើត frontend បន្ទាប់មកបង្កើត ./pi-web
```
