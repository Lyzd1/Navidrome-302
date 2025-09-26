async function redirect2Pan(r) {
    const nvdHost = 'http://127.0.0.1:4533';  // Navidrome 地址
    const remotePrefix = '/Yidong/Music'; // 远端路径前缀
    const alistToken = 'openlist-xxx';  // Openlist 的 Token
    const alistApiPath = 'http://127.0.0.1:5244/api/fs/get'; // Openlist API 路径
    //下面参数一般不需要
    const enableLocalFallback = false; // 新增：是否启用本地路径回退功能
    const localPrefix = '/Local/Music'; // 本地路径前缀
    const localIP = 'xxx'; // 本地IP，用于替换127.0.0.1
    const replacePort = true; // 是否去除端口部分
    const useHttps = true; // 是否使用HTTPS
    // 构造 Navidrome 的 songUri
    let songUri = `${nvdHost}/rest/getSong?`;
    for (let key in r.args) {
        songUri += `${key}=${encodeURIComponent(r.args[key])}&`;
    }
    songUri = songUri.slice(0, -1);
    r.error(`请求ID: ${r.args.id || '未知'}`); // 简化日志，只记录ID
    // 获取 Navidrome 的文件路径
    const nvdApiRes = await getSongPathAsync(songUri, r.headersIn['Cookie'], r.headersIn['User-Agent'], r);
    if (nvdApiRes.startsWith('error')) {
        r.return(500, nvdApiRes);
        return;
    }
    // 1. 解码HTML实体
    const decodedPath = decodeHTMLEntities(nvdApiRes);
    r.error(`原始文件路径: ${decodedPath}`);
    // 2. 首先尝试使用远程路径
    let alistFilePath = decodedPath;
    
    // 不区分大小写检查是否以/music开头
    if (decodedPath.match(/^\/music/i)) {
        // 替换/music前缀（不区分大小写）
        alistFilePath = remotePrefix + decodedPath.substring(decodedPath.toLowerCase().indexOf('/music') + 6);
    } else {
        // 不以/music开头，直接添加前缀
        alistFilePath = remotePrefix + (decodedPath.startsWith('/') ? decodedPath : '/' + decodedPath);
    }
    
    // 3. 确保路径格式正确
    alistFilePath = alistFilePath.replace(/\/+/g, '/');
    if (!alistFilePath.startsWith('/')) {
        alistFilePath = '/' + alistFilePath;
    }
    
    r.error(`远程Alist路径: ${alistFilePath}`);
    // 获取文件信息和直链
    let downloadLinkRes = await fetchAlistFileInfo(alistApiPath, alistFilePath, alistToken, r);
    // 如果远程路径获取失败，尝试本地路径
    if (downloadLinkRes.startsWith('error') && enableLocalFallback) {
        // 构造本地路径
        let localAlistFilePath = decodedPath;
        
        if (decodedPath.match(/^\/music/i)) {
            localAlistFilePath = localPrefix + decodedPath.substring(decodedPath.toLowerCase().indexOf('/music') + 6);
        } else {
            localAlistFilePath = localPrefix + (decodedPath.startsWith('/') ? decodedPath : '/' + decodedPath);
        }
        
        localAlistFilePath = localAlistFilePath.replace(/\/+/g, '/');
        if (!localAlistFilePath.startsWith('/')) {
            localAlistFilePath = '/' + localAlistFilePath;
        }
        // 记录远程路径失败的日志，使用处理后的本地路径
        r.error(`远程路径失败: ${downloadLinkRes}, 启用本地Alist路径: ${localAlistFilePath}`);
        
        // 尝试使用本地路径获取直链
        downloadLinkRes = await fetchAlistFileInfo(alistApiPath, localAlistFilePath, alistToken, r);
        
        if (downloadLinkRes.startsWith('error')) {
            if (downloadLinkRes.startsWith('error401')) {
                r.return(401, downloadLinkRes);
            } else if (downloadLinkRes.startsWith('error404')) {
                r.return(404, downloadLinkRes);
            } else {
                r.return(500, downloadLinkRes);
            }
            return;
        }
    }
    
    // 处理直链格式
    if (downloadLinkRes.includes('127.0.0.1')) {
        // 修改本地链接
        if (useHttps) {
            downloadLinkRes = downloadLinkRes.replace(/http:\/\//, 'https://');
        }
        
        if (localIP) {
            downloadLinkRes = downloadLinkRes.replace(/127\.0\.0\.1/, localIP);
        }
        
        if (replacePort) {
            downloadLinkRes = downloadLinkRes.replace(/:[0-9]+\//, '/');
        }
    }
    // 设置缓存相关的响应头
    r.headersOut['Cache-Control'] = 'public, max-age=300'; // 5分钟缓存
    r.headersOut['Expires'] = new Date(Date.now() + 300000).toUTCString(); // 5分钟后过期
    // 成功获取下载链接，重定向
    r.error(`获取直链成功: ${downloadLinkRes}`);
    r.return(302, downloadLinkRes);
    function decodeHTMLEntities(text) {
        const entities = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#39;': "'",
            '&apos;': "'"
        };
        return text.replace(/&(amp|lt|gt|quot|#39|apos);/g, match => entities[match]);
    }
}
async function fetchAlistFileInfo(alistApiPath, alistFilePath, alistToken, r) {
    const alistRequestBody = {
        "path": alistFilePath,
        "password": ""
    };
    
    try {
        const response = await ngx.fetch(alistApiPath, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': alistToken
            },
            max_response_body_size: 65535,
            body: JSON.stringify(alistRequestBody)
        });
        
        const responseText = await response.text();
        
        if (response.ok) {
            const result = JSON.parse(responseText);
            if (result === null || result === undefined) {
                return `error: alist_api response is null`;
            }
            
            if (result.code === 200) {
                if (result.data.type === 3) { 
                    if (result.data.raw_url) {
                        return result.data.raw_url;
                    } else {
                        return `error: direct link not found in response`;
                    }
                } else {
                    return `error: path is not a file but a folder`;
                }
            }
            
            if (result.code === 401) {
                return `error401: alist_api ${result.message}`;
            }
            if (result.code === 404 || result.message === "file not found" || result.message === "path not found") {
                return `error404: alist_api ${result.message}`;
            }
            return `error: alist_api ${result.code} ${result.message}`;
        } else {
            return `error: alist_api ${response.status} ${response.statusText}`;
        }
    } catch (error) {
        return `error: alist_api ${error}`;
    }
}
async function getSongPathAsync(songUri, cookie, ua, r) {
    try {
        const res = await ngx.fetch(songUri, {
            headers: {
                Cookie: cookie,
                'User-Agent': ua,
                'Accept': 'application/json'
            }
        });
        
        if (res.ok) {
            const responseText = await res.text();
            
            let result;
            // 检查响应是否是XML格式
            if (responseText.trim().startsWith('<')) {
                // 更健壮的XML路径提取
                const pathStart = responseText.indexOf('path="') + 6;
                if (pathStart > 5) {
                    const pathEnd = responseText.indexOf('"', pathStart);
                    if (pathEnd > pathStart) {
                        const path = responseText.substring(pathStart, pathEnd);
                        return path;
                    }
                }
                // 备用方案：尝试正则匹配
                const pathMatch = responseText.match(/path="([^"]+)"/);
                if (pathMatch && pathMatch[1]) {
                    return pathMatch[1];
                }
                return `error: navidrome_api could not parse XML response for path`;
            } else {
                // 尝试解析为JSON
                try {
                    result = JSON.parse(responseText);
                } catch (e) {
                    return `error: navidrome_api could not parse JSON response: ${e}`;
                }
            }
            
            if (result === null || result === undefined) {
                return `error: navidrome_api songUri response is null`;
            }
            
            // 处理JSON响应
            if (result['subsonic-response'] && result['subsonic-response'].song) {
                return result['subsonic-response'].song.path;
            }
            return `error: navidrome_api invalid song response`;
        } else {
            return (`error: navidrome_api ${res.status} ${res.statusText}`);
        }
    } catch (error) {
        return (`error: navidrome_api fetch getSongApi failed, ${error}`);
    }
}
export default { redirect2Pan };
