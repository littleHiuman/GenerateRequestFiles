/*
 * @Author: littleHiuman
 * @Date: 2020-11-27 12:06:50
 * @LastEditTime: 2021-11-02 16:22:03
 * @LastEditors: littleHiuman
 * @Description: 根据swagger生成配置文件
 */
const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')
const argv = process.argv.slice(2)

let urlRegexp1 = /(http(s?):\/\/\d{1,3}(\.\d{1,3}){3}:\d{1,4}(\/?)(,*))+/g
let urlRegexp2 =
  /http(s?):\/\/[a-zA-Z0-9][-a-zA-Z0-9]{0,62}(\.[a-zA-Z0-9][-a-zA-Z0-9]{0,62})+/g

// 检查执行该文件的参数
function checkArgv(arg) {
  let ips = []
  if (!arg.length) {
    throw new Error(
      '出现该错误是因为没有传参，传参例子（多个ip使用,分割）：\n\t--ip=http://255.255.255.255:3000,http://225.225.225.255:300\n\n'
    )
  }
  arg.forEach((item) => {
    let key = item.match(/(?<=--)ip(?==)/)
    if (!key) {
      throw new Error('参数有误，参数以 --ip= 开头')
    }
    key = key[0]

    let value = item.match(urlRegexp1) ? item.match(urlRegexp1)[0] : ''
    if (!value) {
      value = item.match(urlRegexp2) ? item.match(urlRegexp2)[0] : ''
    }
    if (!value) {
      throw new Error('ip 有误')
    }
    if (!key || !value) {
      return
    }
    ips = Array.from(
      new Set(
        value.split(',').map((ip) => {
          if (ip.slice(-1).charCodeAt(0) === 47) {
            ip = ip.slice(0, -1)
          }
          return ip.trim()
        })
      )
    )
    if (!ips.length) {
      throw new Error('ip 有误')
    }
    ips.forEach((ip, i) => {
      const url = `${ip}/swagger-resources`
      getResources(url, i)
    })
  })
}
checkArgv(argv)

function isHttps(url) {
  return url.split(':')[0] === 'https'
}
function requestHandle(url, res, cb) {
  const { statusCode } = res
  const contentType = res.headers['content-type']

  let error
  // 任何 2xx 状态码都表示成功的响应，但是这里只检查 200。
  if (statusCode !== 200) {
    error = new Error(`请求失败\n状态码: ${statusCode}`)
  } else if (!/^application\/json/.test(contentType)) {
    error = new Error(
      '无效的 content-type.\n' +
        `期望的是 application/json 但接收到的是 ${contentType}`
    )
  }
  if (error) {
    console.error(error.message)
    // 消费响应的数据来释放内存。
    res.resume()
    return
  }

  res.setEncoding('utf8')
  let rawData = ''
  res.on('data', (chunk) => {
    rawData += chunk
  })
  res.on('end', () => {
    try {
      const parsedData = JSON.parse(rawData)
      if (cb) {
        cb({ url, parsedData })
      }
    } catch (e) {
      console.error(e.message)
    }
  })
}
// 请求
function httpGet(url, cb) {
  let isHttpsRes = isHttps(url)
  if (isHttpsRes) {
    https
      .get(url, (res) => {
        requestHandle(url, res, cb)
      })
      .on('error', (e) => {
        console.error(`出现错误: ${e.message}`)
      })
  } else {
    http
      .get(url, (res) => {
        requestHandle(url, res, cb)
      })
      .on('error', (e) => {
        console.error(` 出现错误: ${e.message}`)
      })
  }
}

// 主流程
function getResources(url, i) {
  httpGet(url, (res) => {
    const { url, parsedData: data } = res
    let result = url.match(urlRegexp1) ? url.match(urlRegexp1)[0] : ''
    if (!result) {
      result = url.match(urlRegexp2) ? url.match(urlRegexp2)[0] : ''
    }
    if (!result || !data.length) {
      return
    }
    data.forEach((element) => {
      const secUrl = `${result}${element.location}`
      httpGet(secUrl, ({ parsedData }) => {
        const urlsInfo = calculateObj.calcUrl(parsedData.paths)
        const requestInfo = calculateObj.calcRequest(parsedData.paths)
        let infoTitle = ''
        if (parsedData.info && parsedData.info.title) {
          infoTitle = parsedData.info.title
        }
        const info = { title: infoTitle, host: result }
        calculateObj.calcDefinitions(parsedData.definitions, requestInfo)
        folderObj.writeFile(urlsInfo, requestInfo, info, i)
      })
    })
  })
}

// 计算相关
const calculateObj = {
  // 分模块保存url
  calcUrl: function (paths) {
    const temPathsKeys = Object.keys(paths)
    const urlsObj = {}
    let len = 0
    let len2 = 0
    temPathsKeys.forEach((item) => {
      let secKeys = Object.keys(paths[item])
      len += secKeys.length
      const prefix = item.split('/').filter((obj) => obj)
      if (secKeys.length > 1) {
        secKeys = secKeys.map((obj) => (obj = `${item}:${obj}`))
        urlsObj[prefix[0]]
          ? urlsObj[prefix[0]].concat(secKeys)
          : (urlsObj[prefix[0]] = secKeys)
      } else {
        urlsObj[prefix[0]]
          ? urlsObj[prefix[0]].push(item)
          : (urlsObj[prefix[0]] = [item])
      }
    })
    Object.values(urlsObj).forEach((item) => {
      len2 += item.length
    })
    if (len !== len2) {
      console.log(`计算url后缺失${Math.abs(len - len2)}个【原因：url重复】`)
    }
    return urlsObj
  },
  // 处理每个请求的数据（参数、描述、url、请求方式…）
  calcRequest: function (values) {
    const tem = {}
    for (const key in values) {
      const element = values[key]
      if (Object.keys(element).length) {
        for (const eKey in element) {
          const obj = element[eKey]
          let param = {}
          if (obj.parameters) {
            param = calculateObj.calcParameters(obj.parameters, eKey)
          }
          const info = {
            desc: obj.summary,
            param,
            url: key,
            method: eKey
          }
          if (obj.consumes) {
            info.headers = {
              'Content-Type':
                obj.consumes.length === 1 ? obj.consumes + '' : obj.consumes
            }
          }
          if (Object.keys(element).length === 1) {
            tem[key] = info
          } else {
            tem[`${key}:${eKey}`] = info
          }
        }
      }
    }
    return tem
  },
  // 处理请求参数
  calcParameters: function (params, method) {
    const tem = {}
    params.forEach((item) => {
      let prefix = ''
      switch (item.in) {
        case 'query':
          prefix = 'params.'
          break
        case 'body':
        case 'formData':
          prefix = 'data.'
          break
        case 'path':
        case 'header':
        // prefix = ''
        // break
        default:
          if (method === 'get') {
            prefix = 'params.'
          } else if (method === 'post' || method === 'put') {
            prefix = 'data.'
            // } else if (method === 'delete') {
            //   prefix = ''
          }
          break
      }

      let definitions = ''
      if (item.schema && item.schema.$ref) {
        definitions = item.schema.$ref
      } else if (item.schema && item.schema.items && item.schema.items.$ref) {
        definitions = item.schema.items.$ref
      }

      let objParamType = ''
      if (item.type) {
        objParamType = item.type
      } else if (item.schema && item.schema.type) {
        objParamType = item.schema.type
      }
      const obj = {
        paramType: objParamType,
        paramDesc: item.description || ''
        // required: item.required || '',
      }
      if (definitions) {
        obj.definitions = definitions.split('/').slice(-1) + ''
      }
      if (item.in && item.in === 'path') {
        obj.in = item.in
      }
      tem[`${prefix}${item.name}`] = obj
    })
    return tem
  },
  // 处理请求的特殊参数
  calcDefinitions: function (definitions, requestInfo) {
    for (const key in requestInfo) {
      const element = requestInfo[key]
      if (Object.keys(element.param).length) {
        for (const p in element.param) {
          const obj = element.param[p]
          if (obj.definitions) {
            const info = definitions[obj.definitions]
            if (obj.paramType) {
              obj.paramType += `<${info.type}>`
            } else {
              obj.paramType = `${info.type}`
            }
            for (const property in info.properties) {
              const propertyInfo = info.properties[property]
              let { type } = propertyInfo
              if (propertyInfo.items && propertyInfo.items.type) {
                type += `<${propertyInfo.items.type}>`
              }
              element.param[`${p}.${property}`] = {
                paramType: type,
                paramDesc: propertyInfo.description || ''
                // required: obj.required || '',
              }
            }
            delete obj.definitions
          }
        }
      }
    }
  },

  // ================

  // 按模块、模板生成js文件内容
  calcText: function (urlsInfo, requestInfo, info) {
    const fileInfo = {}
    for (const key in urlsInfo) {
      // key是模块
      // element是模块下所有链接
      const element = urlsInfo[key]
      let str = `/**
 * ${info.title}
 * ${key}模块
 * ${info.host}/swagger-ui.html
 */
import request from '@/utils/request'
`
      let names = []
      for (const k in element) {
        //url是具体某条链接
        const urlKey = element[k]
        // 从requestInfo中读取链接的信息
        const requestMsg = requestInfo[urlKey]
        const { desc, param, url, method, ...rest } = requestMsg
        // 参数在url里的
        // 参数不在url里的：params或data
        // 剩余信息rest
        const { paramStr, paramTypeStr, funsParamStr } =
          calculateObj.checkParam(param)
        const requestUrl = calculateObj.calcRequestUrl(url)
        let nameStr = calculateObj.calcNameStr(urlKey, url)
        if (names.includes(nameStr)) {
          nameStr = calculateObj.calcRepeatNameStr(names, url)
        } else {
          names.push(nameStr)
        }
        const restStr = calculateObj.caclRestStr(rest)
        str += `
/**
 * @description ${desc}${paramStr}
 */
export const ${nameStr} = (${funsParamStr}) => request({
  url: ${requestUrl},
  method: '${method}',${paramTypeStr}${restStr}
})
`
      }
      fileInfo[`${key}.js`] = str
    }
    return fileInfo
  },
  // 处理参数注释
  checkParam: function (param) {
    let paramStr = ''
    const paramType = {}
    const funsParam = []
    let funsParamStr
    for (const key in param) {
      const element = param[key]
      paramStr += `
 * @param {${element.paramType}} ${key} ${element.paramDesc}`
      let res = key.match(/(data|params)(?=\.)/)
      if (res) {
        let result = res[0]
        paramType[result] = result
      } else {
        funsParam.push(key)
      }
    }
    funsParamStr = funsParam.join(', ')
    let paramTypeStr = Object.keys(paramType).join(', ')
    funsParamStr += paramTypeStr
    if (paramTypeStr.length) {
      paramTypeStr = `
  ${paramTypeStr},`
    }
    return {
      paramStr,
      paramTypeStr,
      funsParamStr
    }
  },
  // 处理文件中请求的url
  calcRequestUrl: function (url) {
    const index = url.indexOf('{')
    let pathParams = ''
    if (index !== -1) {
      pathParams = url.slice(index + 1, -1)
      url = url.slice(0, index)
    }
    return `\`${url}${pathParams ? `\${${pathParams}}` : ''}\``
  },
  // 处理函数名
  calcNameStr: function (urlKey, url) {
    if (urlKey !== url) {
      let result = urlKey.match(/(?<=:)(get|post|delete|put)/)
      if (!result) {
        return
      }
      result = result[0]
      let prefix = ''
      switch (result) {
        case 'get':
          prefix = 'search'
          break
        case 'post':
          prefix = 'create'
          break
        case 'put':
          prefix = 'update'
          break
        case 'delete':
          prefix = 'remove'
          break
        default:
          break
      }
      const calcName = url
        .split('/')
        .filter((item) => item)
        .reverse()[0]
      let afternameStart = `${calcName.slice(0, 1).toUpperCase()}`
      let afternameEnd = `${calcName.slice(1)}`
      return `${prefix}${afternameStart}${afternameEnd}`
    } else {
      const index = url.indexOf('{')
      if (index !== -1) {
        url = url.slice(0, index)
      }
      if (url.slice(-1).charCodeAt(0) === 47) {
        url = url.slice(0, -1)
      }
      const result = url
        .split('/')
        .filter((item) => item)
        .reverse()
      let res = result[0]
      // 整理自《JavaScript高级程序设计（第4版）》、《JavaScript语言精粹》
      // 关键字与保留字
      const specialWords = [
        'abstract',
        'async',
        'await',
        'boolean',
        'break',
        'byte',
        'case',
        'catch',
        'char',
        'class',
        'const',
        'continue',
        'debugger',
        'default',
        'delete',
        'do',
        'double',
        'else',
        'enum',
        'export',
        'extends',
        'false',
        'final',
        'finally',
        'float',
        'for',
        'function',
        'goto',
        'Infinity',
        'if',
        'implements',
        'import',
        'in',
        'instanceof',
        'int',
        'interface',
        'let',
        'long',
        'NaN',
        'native',
        'new',
        'null',
        'package',
        'private',
        'protected',
        'public',
        'return',
        'short',
        'static',
        'super',
        'switch',
        'synchronized',
        'this',
        'throw',
        'throws',
        'transient',
        'true',
        'try',
        'typeof',
        'undefined',
        'var',
        'void',
        'volatile',
        'while',
        'with',
        'yield'
      ]
      if (specialWords.includes(res)) {
        if (result.length >= 2) {
          res += `${result[1].slice(0, 1).toUpperCase()}${result[1].slice(1)}`
        } else {
          res += Date.now()
        }
      }
      return res
    }
  },
  // 处理出现重复函数名（重命名）
  calcRepeatNameStr: function (allNames, url) {
    const index = url.indexOf('{')
    if (index !== -1) {
      url = url.slice(0, index)
    }
    if (url.slice(-1).charCodeAt(0) === 47) {
      url = url.slice(0, -1)
    }
    const result = url
      .split('/')
      .filter((item) => item)
      .reverse()
    let res = result[0]

    if (result.length >= 2) {
      res += `${result[1].slice(0, 1).toUpperCase()}${result[1].slice(1)}`
    } else {
      res += Date.now()
    }
    if (allNames.includes(res)) {
      console.log(`处理函数名后，还有重复！！`)
      // 没有保存到allNames里
    } else {
      allNames.push(res)
    }
    return res
  },
  // 处理剩余参数
  caclRestStr: function (rest) {
    let restStr = ''
    for (const key in rest) {
      const element = rest[key]
      restStr += `${key}: `
      if (Object.keys(element).length) {
        restStr += `{ `
        for (const left in element) {
          const right = element[left]
          restStr += `'${left}': '${right}'`
        }
        restStr += ` },`
      } else {
        restStr += `${element},`
      }
    }
    if (restStr.length) {
      restStr = `
  ${restStr}`
    }
    return restStr
  }
}

// 文件/文件夹处理相关
const folderObj = {
  // 删除文件夹内的内容
  delDir: function (dirname) {
    let files
    // 如果有这个文件夹
    if (fs.existsSync(dirname)) {
      files = fs.readdirSync(dirname)
      files.forEach((file) => {
        const curPath = `${dirname}/${file}`
        if (fs.statSync(curPath).isDirectory()) {
          // 递归删除文件夹
          folderObj.delDir(curPath)
        } else {
          // 删除文件
          fs.unlinkSync(curPath)
        }
      })
      // 删除当前文件夹（注释的原因是：如果这里删了，下一步还是需要创建文件夹）
      // fs.rmdirSync(dirname);
    }
  },
  // 将处理好的内容写入文件中
  writeFile: function (urlsInfo, requestInfo, info, i) {
    const dirname = `api${i}`
    folderObj.delDir(dirname)
    // 如果没有该文件夹，创建文件夹；文件夹已存在什么都不做
    try {
      fs.statSync(path.join(__dirname, dirname))
    } catch (error) {
      fs.mkdirSync(dirname)
    }
    const fileInfo = calculateObj.calcText(urlsInfo, requestInfo, info)
    for (const key in fileInfo) {
      const element = fileInfo[key]
      fs.writeFileSync(`./${dirname}/${key}`, element, {
        encoding: 'utf8'
      })
    }
    console.log(`${info.host}一共${Object.keys(fileInfo).length}个模块`)
  }
}
