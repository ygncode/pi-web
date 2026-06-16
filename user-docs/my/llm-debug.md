အသုံးပြုသူသည် pi-web ကို အောက်ပါအတိုင်း ထည့်သွင်းနေပါသည်

- pi install npm:@ygncode/pi-web@beta

၎င်းသည် [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) ကို အလိုအလျောက် run ပြီး pi ကို setup ပြုလုပ်ပေးပါသည်။

အသုံးပြုသူတွင် ပြဿနာရှိနေပါက install.sh ၏ setup ကြောင့် ပြဿနာဖြစ်နိုင်ပါသည်။ သင်သည် ပြန်လည်သုံးသပ်ပြီး မည်သည့်အရာက ပြဿနာဖြစ်စေသည်ကို စစ်ဆေးကာ အသုံးပြုသူအား အတိအကျဖော်ပြနိုင်ပါသည်။ ထို့နောက် ၎င်းတို့က သင့်အား ပြင်ဆင်စေလိုပါက မေးမြန်းပါ။ အမြဲတမ်း အသုံးပြုသူနှင့် အတည်ပြုပါ။

အသုံးပြုသူအနေဖြင့် ၎င်းတို့၏ မိုဘိုင်း သို့မဟုတ် အခြားကွန်ရက်မှ pi ကို ဝင်ရောက်အသုံးပြုနိုင်ရန်အတွက် အကြံပြုထားသည့်နည်းလမ်းမှာ tailscale ကို အသုံးပြုပြီး tailscale ကွန်ရက်မှ ဝင်ရောက်ခြင်းဖြစ်သည်။ ထို့အပြင် အသုံးပြုသူသည် ၎င်းတို့၏ tailscale dashboard တွင် HTTPs ကို enable ပြုလုပ်ရန် လိုအပ်ပါသည် - https://login.tailscale.com/admin/dns

အကယ်၍ ၎င်းတို့တွင် tailscale ထည့်သွင်းမထားပါက သို့မဟုတ် tailscale ကို အသုံးမပြုလိုပါက `pi-web status` ကို run ၍ binary လမ်းကြောင်း၊ binary ၏ အခြေအနေနှင့် အပလီကေးရှင်းကို ဝင်ရောက်နိုင်သည့် local endpoint ကို ရယူနိုင်ပါသည်။ သို့သော် သတိပြုရန်မှာ ၎င်းသည် http ဖြစ်သောကြောင့် push notification ရရှိနိုင်မည်မဟုတ်ပါ။

mac တွင် [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist) ဖြင့် setup ပြုလုပ်ပါသည်။
Linux တွင် [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service) ဖြင့် setup ပြုလုပ်ပါသည်။

အကယ်၍ သင်သည် ထပ်မံ၍ debug ပြုလုပ်ရန်နှင့် မည်သို့ဖြစ်နေသည်ကို ကြည့်ရှုရန် လိုအပ်ပါက။
