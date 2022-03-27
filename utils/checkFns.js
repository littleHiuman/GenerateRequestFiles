const { urlRegexp1, urlRegexp2 } = require('./constant')

// 检查执行该文件的参数
function checkArgv(arg) {
  if (!arg.length) {
    throw new Error(
      '出现该错误是因为没有传参，传参例子（多个ip/域名使用,分割）：\n\t--ip=http://255.255.255.255:3000,http://225.225.225.255:300\n\n'
    )
  }

  let ips = null
  for (const item of arg) {
    const state = item.slice(0, 5) == '--ip='
    if (state) {
      ips = item.slice(5).split(',')
      break
    }
  }
  if (!ips) {
    throw new Error(
      '参数有误，传参例子（多个ip/域名使用,分割）：\n\t--ip=http://255.255.255.255:3000,http://225.225.225.255:300\n\n'
    )
  }
  return checkIps(ips)
}

// 检查ip/域名
function checkIps(ips) {
  let ips2 = []
  for (let ip of ips) {
    ip = ip.trim()
    if (ip.slice(-1).charCodeAt(0) === 47) {
      ip = ip.slice(0, -1)
    }
    const result1 = ip.match(urlRegexp1)
    const result2 = ip.match(urlRegexp2)
    if (result1) {
      ips2.push(result1[0])
    } else if (result2) {
      ips2.push(result2[0])
    } else {
      throw new Error('ip 有误')
    }
  }
  ips2 = Array.from(new Set(ips2))
  return ips2
}

// 判断是否是https协议
function isHttps(url) {
  return url.split(':')[0] === 'https'
}

module.exports = { checkArgv, isHttps }
