អ្នកប្រើប្រាស់កំពុងដំឡើង pi-web តាមរយៈ

- pi install npm:@ygncode/pi-web@beta

ដែលវានឹងដំណើរការ [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) ដោយស្វ័យប្រវត្តិ និងរៀបចំ pi។

ប្រសិនបើអ្នកប្រើប្រាស់មានបញ្ហា វាអាចបណ្តាលមកពីការរៀបចំរបស់ install.sh។ អ្នកអាចពិនិត្យនិងឆែកមើលថាតើមានអ្វីកើតឡើង និងប្រាប់អ្នកប្រើប្រាស់អំពីអ្វីដែលបណ្តាលឱ្យមានបញ្ហាពិតប្រាកដ។ ហើយសួរថាតើពួកគេចង់ឱ្យអ្នកជួសជុលឬទេ។ ត្រូវបញ្ជាក់ជាមួយអ្នកប្រើប្រាស់ជានិច្ច។

ដើម្បីឱ្យអ្នកប្រើប្រាស់អាចចូលប្រើ pi នៅលើទូរស័ព្ទដៃ ឬបណ្តាញផ្សេងទៀត។ វិធីដែលបានណែនាំគឺប្រើ tailscale និងចូលប្រើវាតាមបណ្តាញ tailscale។ ហើយអ្នកប្រើប្រាស់នឹងត្រូវបើក HTTPS នៅក្នុងផ្ទាំងគ្រប់គ្រង tailscale របស់ពួកគេ - https://login.tailscale.com/admin/dns

ប្រសិនបើពួកគេមិនបានដំឡើង tailscale ឬមិនចង់ប្រើ tailscale។ ពួកគេអាចដំណើរការ `pi-web status` និងទទួលបានផ្លូវឯកសារ binary ស្ថានភាពរបស់ binary និងចំណុចបញ្ចប់ (endpoint) ក្នុងតំបន់ដែលពួកគេអាចចូលប្រើកម្មវិធីបាន។ ប៉ុន្តែត្រូវកត់សម្គាល់ថា ពួកគេនឹងមិនអាចទទួលបានការជូនដំណឹងបែប push បានទេ ដោយសារវាប្រើ http។

នៅលើ mac វារៀបចំ [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist)
នៅលើ linux វារៀបចំ [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service)

ក្នុងករណីដែលអ្នកត្រូវការបំបាត់កំហុសបន្ថែមនិងមើលថាតើមានអ្វីកើតឡើង។
