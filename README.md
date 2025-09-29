# Navidrome-302

前情提要：
1.如果使用docker部署Navidrome和Openlist，如果不可用，建议开host模式
2.Navidrome参数配置
环境变量：
- ND_SCANNER_SCANONSTARTUP=false  （必设置）
- ND_ENABLEARTWORKPRECACHE=true   （必设置）
- ND_IMAGECACHESIZE=2G            （尽量设置大一点。 设置越大，占用本地空间越大，如果设置过小，播放时则会在空间占满时，从云盘拉取数据。/data/cache/images）
- ND_SCANNER_SCHEDULE=1h           (不要设置过段的扫描时间，也可以设置试试，如果不风控。)

voluemes
- "/你的openlist挂载路径/to/Music路径:/music:ro"  （ro必须要，表示仅读取）


**服务器nginx反代修改：**

**第一步：** 如图所示，云盘音乐webdav挂载到为/Music，然后Docker安装Navidrome时，将其映射到/music目录下。

![image](https://github.com/user-attachments/assets/6b48ceec-579a-4dc7-8889-436a782f8996)

**第二步：** 将navidrome.js 和 nginx.conf文件下载并放置在nginx的conf.d文件夹下，注意修改navidrome.js文件的前面几个参数。
pathPrefix的意思是你alist中音乐文件夹的路径。并会将第一步所设置的挂载路径/music修改为该路径并访问。
alist token请在settings——》Other中获取token
![image](https://github.com/user-attachments/assets/836a6451-5bb7-4906-a5b2-6ebafaf8f754)

**第三步：** 在nginx.conf（nginx自带文件）中首行加上load_module modules/ngx_http_js_module.so; 使用nginx -t 检查配置是否可用，如果js模块不可使用，请自行解决。



**播放器使用：**

**第一步：：** 在音乐播放器中加入你的navidrome服务器——》ip:4531 。在播放时，会发现路径出现问题。请打开服务器网页端，右上角setting——》player——》点击你所使用的播放器——》选中Report Real Path即可。

![image](https://github.com/user-attachments/assets/19fce088-19e0-4998-bbbb-8f1c4e596baa)
![image](https://github.com/user-attachments/assets/67622acd-46f9-4255-80f0-e5c7aa225bdc)


**第二步：** 查看nginx文件夹下的log文件夹中的error.log文件，使用tail -f error.log日志如下代表成功将/music路径替换为/Yidong/Music路径。并在后面成功获取到直链。

2025/04/04 06:05:16 [error] 23#23: *3344 js: 原始文件路径: /music/「日系纯音向」夏树眠 蝉在叫/萤火虫 - 萤火虫之舞.flac
2025/04/04 06:05:16 [error] 23#23: *3344 js: 解码后路径: /music/「日系纯音向」夏树眠 蝉在叫/萤火虫 - 萤火虫之舞.flac
2025/04/04 06:05:16 [error] 23#23: *3344 js: 最终Alist路径: /Yidong/Music/「日系纯音向」夏树眠 蝉在叫/萤火虫 - 萤火虫之舞.flac
2025/04/04 06:05:16 [error] 23#23: *3344 js: Fetching file info with path: /Yidong/Music/「日系纯音向」夏树眠 蝉在叫/萤火虫 - 萤火虫之舞.flac


最后感谢syqman和bpking大佬的脚本

<a href="https://syq.pub/archives/93/">syqman</a>
<a href="https://blog.738888.xyz/">bpking</a>

