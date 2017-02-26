// ----------------Configure--------------------
var config = require('./config.js')
// ---------------Environnement-----------------
var app = require('express')()
var server = require('http').Server(app)
var io = require('socket.io')(server)
var path = require('path')
var favicon = require('serve-favicon')
var WebTorrent = require('webtorrent')
var client = new WebTorrent()
var dirPort = config.dirPort
var listTorrents = []
var sockets = [] // Liste des sockets client
var isDownloading = true
// ------------express-------------------
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))
app.use(require('express').static(path.join(__dirname, 'public')))
server.listen(3000)
console.log('Server on 3000; http://localhost:3000')

// 解决跨域
app.all('*', function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Content-Length, Authorization, Accept, X-Requested-With , yourHeaderFeild')
  res.header('Access-Control-Allow-Methods', 'GET,PUT, POST')
  if (req.method === 'OPTIONS') {
    // 让options请求快速返回
    res.send(200)
  } else {
    next()
  }
})

app.get('/', function (req, res) {
  res.render('index')
})

io.sockets.on('connection', function (socket) {
  if (sockets.indexOf(socket) === -1) {
    console.log(socket.id + ' connection')
    sockets.push(socket)
  }

  socket.on('download', function (data) {
    isDownloading = true
    var torrentId = data.torrentId
    if ((torrentId !== 'undefined') && !isExsitedTorrentID(torrentId)) {
      listTorrents.push(torrentId)
      /**
       * 开始下载
       */
      client.add(torrentId, config, function (torrent) {
        var files = torrent.files
        files.forEach(function (file) {
          setInterval(function () {
            var result = {}
            if (isDownloading) {
              result['isDownloading'] = true
            } else {
              result['isDownloading'] = false
            }
            result['file'] = file.name
            result['downSpeed'] = prettyBytes(torrent.downloadSpeed)
            result['progress'] = torrent.progress
            result['timeRemaining'] = torrent.timeRemaining
            io.sockets.emit('showDownloadInfo', JSON.stringify(result))
          }, 500)
        }, this)

        torrent.on('done', function () {
          console.log('种子下载完成')
          torrent.files.forEach(function (file, index) {
            console.log(file.name + '[' + index + '] 完成')
          })
          // var server = torrent.createServer()
          // server.listen(dirPort)
          isDownloading = false
          var result = {}
          result['isDownloading'] = false
          result['downSpeed'] = prettyBytes(torrent.downloadSpeed)
          result['progress'] = torrent.progress
          result['timeRemaining'] = torrent.timeRemaining
          io.sockets.emit('showDownloadInfo', JSON.stringify(result))
        })
        // server.close()
        // client.destroy()
      })
    }
  })

  socket.on('disconnect', function (o) {
    var indexSocket = sockets.indexOf(socket)
    if (indexSocket !== -1) {
      sockets.splice(indexSocket, 1)
      console.log(socket.id + '离开')
    }
  })
})

/**
 * 每个Torrent文件应该独立
 * id of torrentId must be uniq
 */
function isExsitedTorrentID (torrentId) {
  if (listTorrents.indexOf(torrentId) !== -1) {
    return true
  }
  return false
}

/**
 * 转换并显示下载速度
 * show the downloadSpeed for human
 */
function prettyBytes (num) {
  var exponent, unit, neg = num < 0, units = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  if (neg) num = -num
  if (num < 1) return (neg ? '-' : '') + num + ' B'
  exponent = Math.min(Math.floor(Math.log(num) / Math.log(1000)), units.length - 1)
  num = Number((num / Math.pow(1000, exponent)).toFixed(2))
  unit = units[exponent]
  return (neg ? '-' : '') + num + ' ' + unit
}
