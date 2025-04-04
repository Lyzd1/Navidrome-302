async function redirect2Pan(r) {
    const nvdHost = 'http://127.0.0.1:4533';  // Navidrome 地址
    const pathPrefix = '/Yidong/Music'; // 路径前缀 比如作者的Navidrome音乐文件夹在/Yidong/Music，注意：这里会自动替换掉navidrome挂载路径/music 或者/Music 为这个路径前缀
    const alistToken = 'alist-xxx';  // Alist的Token
    const alistApiPath = 'http://127.0.0.1:5244/api/fs/get'; // Alist API 路径
    const alistDownloadApiPath = 'http://127.0.0.1:5244/api/fs/link'; // Alist API 路径

    // 构造 Navidrome 的 songUri
    let songUri = `${nvdHost}/rest/getSong?`;
    for (let key in r.args) {
        songUri += `${key}=${encodeURIComponent(r.args[key])}&`;
    }
    songUri = songUri.slice(0, -1);
    r.error(`songUri: ${songUri}`);

    // 获取 Navidrome 的文件路径
    const nvdApiRes = await getSongPathAsync(songUri, r.headersIn['Cookie'], r.headersIn['User-Agent'], r);
    if (nvdApiRes.startsWith('error')) {
        r.error(nvdApiRes);
        r.return(500, nvdApiRes);
        return;
    }
    r.error(`原始文件路径: ${nvdApiRes}`);

    // 1. 解码HTML实体
    const decodedPath = decodeHTMLEntities(nvdApiRes);
    r.error(`解码后路径: ${decodedPath}`);

    // 2. 转换为Alist路径
    let alistFilePath = decodedPath;
    
    // 不区分大小写检查是否以/music开头
    if (decodedPath.match(/^\/music/i)) {
        // 替换/music前缀（不区分大小写）
        alistFilePath = pathPrefix + decodedPath.substring(decodedPath.toLowerCase().indexOf('/music') + 6);
    } else {
        // 不以/music开头，直接添加前缀
        alistFilePath = pathPrefix + (decodedPath.startsWith('/') ? decodedPath : '/' + decodedPath);
    }
    
    // 3. 确保路径格式正确
    alistFilePath = alistFilePath.replace(/\/+/g, '/');
    if (!alistFilePath.startsWith('/')) {
        alistFilePath = '/' + alistFilePath;
    }
    
    r.error(`最终Alist路径: ${alistFilePath}`);

    // 首先获取文件信息，确认文件存在
    const fileInfoRes = await fetchAlistFileInfo(alistApiPath, alistFilePath, alistToken, r);
    if (fileInfoRes.startsWith('error')) {
        r.error(`File info error: ${fileInfoRes}`);
        if (fileInfoRes.startsWith('error401')) {
            r.return(401, fileInfoRes);
        } else if (fileInfoRes.startsWith('error404')) {
            r.return(404, fileInfoRes);
        } else {
            r.return(500, fileInfoRes);
        }
        return;
    }

    // 文件存在，获取下载链接
    const downloadLinkRes = await fetchAlistDownloadLink(alistDownloadApiPath, alistFilePath, alistToken, r);
    if (downloadLinkRes.startsWith('error')) {
        r.error(`Download link error: ${downloadLinkRes}`);
        if (downloadLinkRes.startsWith('error401')) {
            r.return(401, downloadLinkRes);
        } else if (downloadLinkRes.startsWith('error404')) {
            r.return(404, downloadLinkRes);
        } else {
            r.return(500, downloadLinkRes);
        }
        return;
    }

    // 成功获取下载链接，重定向
    r.error(`redirect to: ${downloadLinkRes}`);
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
        "password": ""  // 如果需要密码，可以在这里添加
    };
    
    r.error(`Fetching file info with path: ${alistFilePath}`);
    
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
        r.error(`Alist file info API response: ${responseText}`);
        
        if (response.ok) {
            const result = JSON.parse(responseText);
            if (result === null || result === undefined) {
                return `error: alist_file_info_api response is null`;
            }
            
            if (result.code === 200) {
                if (result.data.type === 3) { 
                    r.error(`File found: ${result.data.name}, size: ${result.data.size}`);
                    return "success";
                } else {
                    return `error: path is not a file but a folder`;
                }
            }
            
            if (result.code === 401) {
                return `error401: alist_file_info_api ${result.message}`;
            }
            if (result.code === 404 || result.message === "file not found" || result.message === "path not found") {
                return `error404: alist_file_info_api ${result.message}`;
            }
            return `error: alist_file_info_api ${result.code} ${result.message}`;
        } else {
            return `error: alist_file_info_api ${response.status} ${response.statusText}`;
        }
    } catch (error) {
        r.error(`Error fetching file info: ${error}`);
        return `error: alist_file_info_api ${error}`;
    }
}

async function fetchAlistDownloadLink(alistDownloadApiPath, alistFilePath, alistToken, r) {
    const alistRequestBody = {
        "path": alistFilePath,
        "password": ""  // 如果需要密码，可以在这里添加
    };
    
    r.error(`Fetching download link with path: ${alistFilePath}`);
    
    try {
        const response = await ngx.fetch(alistDownloadApiPath, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': alistToken
            },
            max_response_body_size: 65535,
            body: JSON.stringify(alistRequestBody)
        });
        
        const responseText = await response.text();
        r.error(`Alist download link API response: ${responseText}`);
        
        if (response.ok) {
            const result = JSON.parse(responseText);
            if (result === null || result === undefined) {
                return `error: alist_download_link_api response is null`;
            }
            
            if (result.code === 200) {
                if (result.data && result.data.url) {
                    r.error(`Download link: ${result.data.url}`);
                    return result.data.url;
                } else {
                    return `error: download link not found in response`;
                }
            }
            
            if (result.code === 401) {
                return `error401: alist_download_link_api ${result.message}`;
            }
            if (result.code === 404 || result.message === "file not found" || result.message === "path not found") {
                return `error404: alist_download_link_api ${result.message}`;
            }
            return `error: alist_download_link_api ${result.code} ${result.message}`;
        } else {
            return `error: alist_download_link_api ${response.status} ${response.statusText}`;
        }
    } catch (error) {
        r.error(`Error fetching download link: ${error}`);
        return `error: alist_download_link_api ${error}`;
    }
}

async function getSongPathAsync(songUri, cookie, ua, r) {
    try {
        const res = await ngx.fetch(songUri, {
            headers: {
                Cookie: cookie,
                'User-Agent': ua,
                'Accept': 'application/json' // 优先请求JSON格式
            }
        });
        
        if (res.ok) {
            const responseText = await res.text();
            r.error(`Navidrome API response: ${responseText}`);
            
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
        r.error(`Error fetching getSongApi: ${error}`);
        return (`error: navidrome_api fetch getSongApi failed, ${error}`);
    }
}

export default { redirect2Pan };
