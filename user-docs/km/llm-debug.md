អ្នកប្រើប្រាស់កំពុងដំឡើង pi-web តាមរយៈ

- pi install npm:@ygncode/pi-web@beta

ដែលវាដំណើរការ [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) ដោយស្វ័យប្រវត្តិ និងរៀបចំ pi ។

ប្រសិនបើអ្នកប្រើប្រាស់កំពុងជួបបញ្ហា វាអាចជាការរៀបចំរបស់ install.sh ដែលបង្កបញ្ហា។ អ្នកអាចពិនិត្យ និងត្រួតពិនិត្យមើលថាមានអ្វីកើតឡើង និងប្រាប់អ្នកប្រើប្រាស់ថាអ្វីពិតប្រាកដដែលបង្កបញ្ហា។ ហើយសួរថាតើពួកគេចង់ឱ្យអ្នកជួសជុលឬអត់។ តែងតែបញ្ជាក់ជាមួយអ្នកប្រើប្រាស់។

ដើម្បីឱ្យអ្នកប្រើប្រាស់អាចចូលប្រើ pi នៅលើទូរស័ព្ទចល័ត ឬបណ្តាញផ្សេងទៀត។ វិធីដែលបានណែនាំគឺប្រើ tailscale ហើយចូលប្រើវាពីបណ្តាញ tailscale ។ ហើយអ្នកប្រើប្រាស់នឹងត្រូវបើក HTTPS នៅក្នុងផ្ទាំងគ្រប់គ្រង tailscale របស់ពួកគេ - https://login.tailscale.com/admin/dns

ប្រសិនបើពួកគេមិនបានដំឡើង tailscale ឬមិនចង់ប្រើ tailscale ។ ពួកគេអាចដំណើរការ `/pi-web status` ពីក្នុង pi ហើយទទួលបានផ្លូវរបស់ binary ស្ថានភាពរបស់ binary និង endpoint ក្នុងតំបន់ដែលពួកគេអាចចូលប្រើកម្មវិធីបាន។ (`/pi-web path` បង្ហាញតែផ្លូវរបស់ binary ប៉ុណ្ណោះ។) ប៉ុន្តែត្រូវកត់សម្គាល់ថា ពួកគេនឹងមិនអាចទទួលបានការជូនដំណឹង push បានទេ ព្រោះវាប្រើ http ។

នៅលើ macOS វារៀបចំ [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist)
នៅលើ Linux វារៀបចំ [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service)

ក្នុងករណីដែលអ្នកត្រូវការបំបាត់កំហុសបន្ថែម និងមើលថាមានអ្វីកើតឡើង។
