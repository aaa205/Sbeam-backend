let mysql = require('mysql')
let pool = mysql.createPool({
    host: '47.103.82.240',
    port: '3306',
    user: 'sb',
    password: '1234',
    database: 'sbeam',
    connectionLimit: 5
})
let express = require('express')
let server = express()
let port = 80
server.listen(port, () => {
    console.log('服务器正在监听:', port)

})
//根路径
const root = '/api'
//自定义中间件：允许指定客户端的跨域访问
server.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', 'http://localhost:8080')
    res.set('Access-Control-Allow-Headers','Content-Type')
    res.set('Access-Control-Allow-Methods', '*')
    next()//让后续的请求处理方法继续处理
})
//解析body
const bodyParser=require('body-parser')
server.use(bodyParser.json())
server.use(bodyParser.urlencoded())

/**
 * 引入数据检验
 */
const schema = require('./validate')

/**
 * 用户注册
 */
server.post(`${root}/register`, (req, resp) => {
    let data = req.body
    data = schema.register.validate(data)//检验数据 注意数据在value里
    if (data.error) {
        //检验数据 如果数据不对则返回第一个错的信息
        resp.json({ ret: 1, msg: data.error.details[0].message })
        return
    }
    data = data.value//提取数据
    //先查询有没有重复
    let sql = 'SELECT id FROM sb_user WHERE name=? OR email =?'
    pool.query(sql, [data.name, data.email], (err, res) => {
        if (err) {
            resp.status(500).send('服务器炸了')
            throw err
        }
        //查到重复用户信息
        if (res.length > 0) {
            resp.json({ ret: 2, msg: '该用户已注册' })
            return
        }
        //没有重复注册，插入数据库
        let sql = 'INSERT INTO sb_user (`name`,email,`password`) values(?,?,?)'
        pool.query(sql, [data.name, data.email, data.password], (err, res) => {
            if (err) {
                resp.status(500).send('服务器炸了')
                throw err
            }
            resp.json({ ret: 0, msg: '注册成功' })
        })
    })

})

/**
 * 获取所有GameCard的内容(前80个)
 */
server.get(`${root}/games`, (req, resp) => {
    //id 为 6 的The Outer Worlds封面图有问题 先不用了
    let sql = 'SELECT id,name,price,publisher,developer,card_img,logo_img FROM sb_product WHERE id !=6 LIMIT 80 '
    pool.query(sql, (err, res) => {
        if (err) {
            resp.status(500).send('服务器炸了')
            console.log(err.message)
            return
        }
        resp.json(res)
    })
})