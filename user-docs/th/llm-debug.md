ผู้ใช้กำลังติดตั้ง pi-web ผ่าน

- pi install npm:@ygncode/pi-web@beta

ซึ่งจะรัน [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) โดยอัตโนมัติและตั้งค่า pi

หากผู้ใช้พบปัญหา อาจเกิดจากการตั้งค่าของ install.sh ที่เป็นสาเหตุ คุณสามารถตรวจสอบและดูว่าเกิดอะไรขึ้น และแจ้งผู้ใช้ให้ทราบถึงสาเหตุที่แน่ชัดของปัญหา พร้อมถามว่าต้องการให้คุณแก้ไขหรือไม่ ยืนยันกับผู้ใช้เสมอ

เพื่อให้ผู้ใช้สามารถเข้าถึง pi บนมือถือหรือเครือข่ายอื่นได้ วิธีที่แนะนำคือการใช้ tailscale และเข้าถึงผ่านเครือข่าย tailscale และผู้ใช้จะต้องเปิดใช้งาน HTTPs ในแดชบอร์ด tailscale ของตน - https://login.tailscale.com/admin/dns

หากผู้ใช้ไม่ได้ติดตั้ง tailscale หรือไม่ต้องการใช้ tailscale สามารถรัน `pi-web status` เพื่อดูพาธของไบนารี สถานะของไบนารี และเอนด์พอยต์ภายในที่สามารถเข้าถึงแอปพลิเคชันได้ แต่ควรทราบว่า จะไม่สามารถรับการแจ้งเตือนแบบพุชได้เนื่องจากเป็น http

บน mac จะตั้งค่า [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist)
บน linux จะตั้งค่า [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service)

ในกรณีที่คุณต้องการตรวจแก้จุดบกพร่องเพิ่มเติมและดูว่าเกิดอะไรขึ้น
