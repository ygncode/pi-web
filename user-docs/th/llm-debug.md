ผู้ใช้กำลังติดตั้ง pi-web ผ่านทาง

- pi install npm:@ygncode/pi-web@beta

ซึ่งจะรัน [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) โดยอัตโนมัติและตั้งค่า pi

หากผู้ใช้พบปัญหา อาจเป็นเพราะการตั้งค่าของ install.sh เป็นสาเหตุของปัญหา คุณสามารถตรวจสอบและดูว่าเกิดอะไรขึ้น และแจ้งผู้ใช้ว่าอะไรคือสาเหตุที่แท้จริงของปัญหา พร้อมถามว่าต้องการให้คุณแก้ไขหรือไม่ ต้องยืนยันกับผู้ใช้เสมอ

เพื่อให้ผู้ใช้สามารถเข้าถึง pi จากมือถือหรือเครือข่ายอื่น วิธีที่แนะนำคือใช้ tailscale และเข้าถึงผ่านเครือข่าย tailscale และผู้ใช้จะต้องเปิดใช้งาน HTTPS ในแดชบอร์ด tailscale ของตน - https://login.tailscale.com/admin/dns

หากพวกเขาไม่ได้ติดตั้ง tailscale หรือไม่ต้องการใช้ tailscale พวกเขาสามารถรัน `/pi-web status` จากภายใน pi เพื่อดูเส้นทางของไบนารี สถานะของไบนารี และปลายทาง (endpoint) ในเครื่องซึ่งใช้เข้าถึงแอปพลิเคชันได้ (`/pi-web path` จะพิมพ์เฉพาะเส้นทางของไบนารีเท่านั้น) แต่ต้องทราบว่า พวกเขาจะไม่ได้รับการแจ้งเตือนแบบพุชเนื่องจากใช้งานผ่าน http

บน mac จะตั้งค่า [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist)
บน linux จะตั้งค่า [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service)

ในกรณีที่คุณต้องดีบักเพิ่มเติมและดูว่าเกิดอะไรขึ้น
