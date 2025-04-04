# Navidrome-302

**服务器nginx反代修改：**

**第一步：** 如图所示，确认Navidrome的挂载路径为/music 或者 /Music （前面的宿主机路径随意，后面容器内路径需要为前面的示例。）

![image](https://github.com/user-attachments/assets/6b48ceec-579a-4dc7-8889-436a782f8996)

**第二步：** 将navidrome.js 和 nginx.conf文件下载并放置在nginx的conf.d文件夹下，注意修改navidrome.js文件的前面几个参数。
pathPrefix的意思是你alist中音乐文件夹的路径。并会将第一步所设置的挂载路径/music修改为该路径并访问。
alist token请在settings——》Other中获取token
![image](https://github.com/user-attachments/assets/836a6451-5bb7-4906-a5b2-6ebafaf8f754)

**第三步：** 在nginx.conf（nginx自带文件）中首行加上load_module modules/ngx_http_js_module.so; 如不可以使用请自行想办法。



**播放器使用：**

**第一步：：** 在音乐播放器中加入你的navidrome服务器——》ip:4531 。在播放时，会发现路径出现问题。请打开服务器网页端，右上角setting——》player——》点击你所使用的播放器——》选中Report Real Path即可。

![image](https://github.com/user-attachments/assets/19fce088-19e0-4998-bbbb-8f1c4e596baa)
![image](https://github.com/user-attachments/assets/67622acd-46f9-4255-80f0-e5c7aa225bdc)


**第二步：** 查看nginx文件夹下的log文件夹中的error.log文件，使用tail -f error.log日志如下代表成功将/music路径替换为/Yidong/Music路径。并在后面成功获取到直链。

2025/04/04 06:05:16 [error] 23#23: *3344 js: 原始文件路径: /music/「日系纯音向」夏树眠 蝉在叫/萤火虫 - 萤火虫之舞.flac
2025/04/04 06:05:16 [error] 23#23: *3344 js: 解码后路径: /music/「日系纯音向」夏树眠 蝉在叫/萤火虫 - 萤火虫之舞.flac
2025/04/04 06:05:16 [error] 23#23: *3344 js: 最终Alist路径: /Yidong/Music/「日系纯音向」夏树眠 蝉在叫/萤火虫 - 萤火虫之舞.flac
2025/04/04 06:05:16 [error] 23#23: *3344 js: Fetching file info with path: /Yidong/Music/「日系纯音向」夏树眠 蝉在叫/萤火虫 - 萤火虫之舞.flac
