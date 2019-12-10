let mysql = require('mysql')
let pool = mysql.createPool({
    host: '47.103.82.240',
    port: '3306',
    user: 'sb',
    password: '1234',
    database: 'sbeam',
    connectionLimit: 5
})
let request = require('request')
let express = require('express')
let app = express()
let port = 80
app.listen(port, () => {
    console.log('服务器正在监听:', port)

})
//根路径
const root = '/api'
//自定义中间件：允许指定客户端的跨域访问
app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', 'http://localhost:8080')
    res.set('Access-Control-Allow-Headers', 'Content-Type')
    res.set('Access-Control-Allow-Methods', '*')
    res.set('Access-Control-Allow-Credentials', 'true')
    next()//让后续的请求处理方法继续处理
})
//解析body
const bodyParser = require('body-parser')
app.use(bodyParser.json())
app.use(bodyParser.urlencoded())
/**
 * 引入数据检验
 */
const schema = require('./validate')
//引入session
let session = require('express-session')
app.use(session({
    secret: '114514'
}))
//引入cookie
let cookieParser = require('cookie-parser')
app.use(cookieParser())
/**
 * 登录
 */
app.post(`${root}/login`, (req, resp) => {
    let result = schema.login.validate(req.body)
    if (result.error) {
        //检验数据 如果数据不对则返回第一个错的信息
        resp.json({ ret: 1, msg: data.error.details[0].message })
        return
    }
    let user = result.value
    let sql = 'SELECT id,name,avatar FROM sb_user WHERE email=? and password=?'
    pool.query(sql, [user.email, user.password], (err, res) => {
        if (err) {
            resp.status(500).send('服务器炸了')
            console.log(err.message)
            return
        }
        if (res.length == 0) {
            resp.json({ ret: 1, msg: '账户邮箱或密码错误' })
        } else {
            req.session.userID = res[0].id//表示已经登录
            let option = { httpOnly: false }
            resp.cookie('userID', res[0].id, option)//保存用户信息
            resp.cookie('userName', res[0].name, option)
            resp.cookie('avatar', res[0].avatar, option)
            resp.cookie('isLogin', true)
            resp.json({ ret: 0, msg: '登录成功' })
        }
    })

})
/**
 * 用户注册
 */
app.post(`${root}/register`, (req, resp) => {
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

            req.session.userID = res[0].id//表示已经登录
            let option = { httpOnly: false }
            resp.cookie('userID', res.insertId, option)//保存用户信息
            resp.cookie('userName', data.name, option)
            resp.cookie('isLogin', true)
            //获取头像
            pool.query('SELECT avatar from sb_user WHERE id=?', [res.inserId], (err, res) => {
                if (err) {
                    resp.status(500).send('服务器炸了')
                    throw err
                }
                if (res.length > 0)
                    resp.cookie('avatar', res[0])
                resp.json({ ret: 0, msg: '注册成功' })
            })
        })
    })
})
/**
 * 注销登录
 */
app.get(`${root}/logout`, (req, resp) => {
    resp.cookie('isLogin', false)
    req.session.destroy()//销毁session
    resp.send()
})

/**
 * 搜索游戏
 */
app.get(`${root}/games`, (req, resp) => {
    let kw = req.query.kw//搜索关键词
    //如果没有输入搜索关键词，则返回所有GameCard（最多80个）
    if (typeof (kw) == "undefined" || kw == '') {
        let sql = 'SELECT id,name,price,publisher,developer,card_img,logo_img FROM sb_product LIMIT 80 '
        pool.query(sql, (err, res) => {
            if (err) {
                resp.status(500).send('服务器炸了')
                console.log(err.message)
                return
            }
            resp.json(res)
        })
    } else {
        //如果有搜索关键词，则执行搜索
        kw = kw.trim()
        let sql = "SELECT id,name,price,publisher,developer,card_img,logo_img FROM sb_product WHERE name LIKE concat('%',?,'%') LIMIT 80 "
        pool.query(sql, [kw], (err, res) => {
            if (err) {
                resp.status(500).send('服务器炸了')
                console.log(err.message)
                return
            }
            resp.json(res)
        })
    }

})
/**
 * 首页内容
 */
app.get(`${root}/index`, (req, resp) => {
    let sql = 'SELECT id,name,price,publisher,developer,card_img,logo_img FROM sb_product LIMIT 4'
    pool.query(sql, (err, res) => {
        if (err) {
            resp.status(500).send('服务器炸了')
            console.log(err.message)
            return
        }
        resp.json(res)
    })
})
/**
 * 游戏详情
 */
app.get(`${root}/games/:id`, (req, resp) => {
    let id = parseInt(req.params.id)
    let sql = "SELECT id,name,description,price,release_date,\
    developer,publisher,is_single_player,is_multi_player,is_cloud_save,\
    supported_languages,logo_img,img_0,img_1,img_2,img_3\
    FROM sb_product WHERE id = ?"
    let data = {}
    pool.query(sql, [id], (err, res) => {
        if (err) {
            resp.status(500).send('服务器炸了')
            console.log(err.message)
            return
        }
        if (res.length > 0) {
            data = res[0]
            sql = 'SELECT os_id,os,cpu,gpu,ram FROM sb_product_specification WHERE product_id = ?'
            pool.query(sql, [id], (err, res) => {
                if (err) {
                    resp.status(500).send('服务器炸了')
                    console.log(err.message)
                    return
                }
                //如果查不到，给默认值
                if (res.length == 0) {
                    data.spec = [{ os_id: 0, os: "N/A", cpu: "N/A", gpu: "N/A", ram: "N/A" }]
                } else {
                    data.spec = res
                }
                resp.json(data)
                return
            })
        } else {
            //没查到
            resp.status(404).send('资源不存在')
        }
    })
})

/**
 * 添加到购物车,需要先登录
 * 请求示例
 * http://localhost/api/cart/addCartItems?add={"product_id":1,"quantity":2}
 */
app.get(`${root}/cart/addCartItems`, (req, resp) => {
    let userID = req.session.userID
    //没登录
    if (!userID) {
        resp.status(403).json({ ret: 1, msg: '请先登录' })
        return
    }
    //{product_id,quantity}
    let add = JSON.parse(req.query.add)
    let result = schema.cartAdd.validate(add)
    if (result.error) {
        //检验数据 如果数据不对则返回第一个错的信息
        resp.json({ ret: 1, msg: data.error.details[0].message })
        return
    }
    let sql0 = 'SELECT quantity FROM sb_cart WHERE user_id=? AND product_id=? '
    let oldQuantity = 0
    pool.query(sql0, [userID, add.product_id], (err, res) => {
        if (err) {
            console.log(err.message)
            resp.status(500).end()
            return
        }
        //已在购物车，修改数量
        if (res.length > 0) {
            oldQuantity = res[0].quantity
            pool.query('UPDATE sb_cart SET quantity=? WHERE user_id=? AND product_id=?',
                [add.quantity + oldQuantity, userID, add.product_id], (err, res) => {
                    if (err) {
                        resp.json({ ret: 1, msg: 'fail' })
                    } else {
                        resp.json({ ret: 0, msg: "update success" })
                    }
                    return
                })
        } else {
            //不在购物车，添加一行
            pool.query('INSERT INTO sb_cart VALUES(?,?,?)', [userID, add.product_id, add.quantity], (err, res) => {
                if (err) {
                    resp.json({ ret: 1, msg: 'fail' })
                } else {
                    resp.json({ ret: 0, msg: "insert success" })
                }
                return
            })

        }
    })

})

/**
 * 获取购物车的内容,需要登录
 */
app.get(`${root}/cart`, (req, resp) => {
    let userID = req.session.userID
    //没登录
    if (!userID) {
        resp.status(403).json({ ret: 2, msg: '请先登录' })
        return
    }
    let sql = 'SELECT product_id FROM sb_cart WHERE user_id=?'
    pool.query(sql, [userID], (err, res) => {
        if (res.length == 0)
            resp.json({ ret: 0, msg: '购物车为空', items: [] })
        else {
            let ids = res.map(i => i.product_id)//取出product_id
            pool.query('SELECT id,name,description,price,logo_img,quantity \
            FROM sb_product,sb_cart WHERE id IN (?) AND sb_cart.user_id=? AND sb_cart.product_id=id ',
                [ids, userID], (err, res) => {
                    if (err) {
                        resp.status(500).send('服务器炸了')
                        console.log(err.message)
                        return
                    }
                    resp.json({ ret: 0, msg: 'success', items: res })
                    return
                })
        }
    })
})

/**
 * 异步修改购物车表内容
 * {product_id:1,quantity:2,type="update"}//更新
 * {product_id:1,quantity:2,type="delete"}//删除 此时quantity参数不影响结果
 */
app.post(`${root}/cart/asynUpdate`, (req, resp) => {
    let userID = req.session.userID
    //没登录
    if (!userID) {
        resp.status(403).json({ ret: 2, msg: '请先登录' })
        return
    }
    let data = req.body
    if (schema.asynUpdate.validate(data).error) {
        resp.json({ ret: 3, msg: 'invalid params' })
        return
    }
    if (data.type === 'update') {
        pool.query('UPDATE sb_cart SET quantity=?  WHERE user_id=? AND product_id=?',
            [data.quantity, userID, data.product_id], (err, res) => {
                if (err) {
                    resp.json({ ret: 4, msg: 'update fail' })
                } else {
                    resp.json({ ret: 0, msg: 'success' })
                }
            })
    } else if (data.type === 'delete') {
        pool.query('DELETE FROM sb_cart WHERE user_id=? AND product_id=?',
            [userID, data.product_id], (err, res) => {
                if (err) {
                    resp.json({ ret: 4, msg: { ret: 4, msg: 'delete fail' } })
                } else {
                    resp.json({ ret: 0, msg: 'success' })
                }
            })
    } else
        resp.json({ ret: 3, msg: 'invalid type' })
    return
})

/**
 * 提交订单
 * {items:[{product_id,quantity}]}
 */
app.post(`${root}/orders`, (req, resp) => {
    let userID = req.session.userID
    //没登录
    if (!userID) {
        resp.status(403).json({ ret: 2, msg: '请先登录' })
        return
    }
    //检验数据
    let items = req.body.items
    if (!items || items.length == 0) {
        resp.status(400).send('need {items:[]}')
        return
    }
    //建立订单,使用事务,写法太粗暴，以后改，呕了
    pool.getConnection((err, con) => {
        con.beginTransaction((error) => {
            //失败 回滚
            if (error) {
                con.rollback(() => {
                    con.release()
                    resp.status(500).send()
                    return
                })
            } else {
                con.query('INSERT INTO sb_order VALUES(null,?,?)', [userID, Date.now()], (err, res) => {
                    //失败回滚
                    if (err) {
                        con.rollback(() => {
                            con.release()
                            resp.status(500).send()
                            return
                        })
                    } else {
                        let order_id = res.insertId//订单id
                        //查询即将插入的商品的信息
                        let ids = items.map(x => x.product_id)
                        con.query('SELECT id,name,description,price,logo_img FROM sb_product WHERE id IN (?)', [ids], (err, res) => {
                            if (err) {
                                con.rollback(() => {
                                    con.release()
                                    resp.status(500).send()
                                })
                            } else {
                                //找到了所有信息,组合对象
                                if (res.length == items.length) {
                                    res.forEach(r => {
                                        for (let i = 0; i < res.length; i++) {
                                            if (r.id == items[i].product_id) {
                                                r.quantity = items[i].quantity
                                                break
                                            }
                                        }
                                    })
                                } else {
                                    con.rollback(() => {
                                        con.release()
                                        resp.status(500).send('有商品不存在')
                                    })
                                }
                                //此时res数组的对象包含了quantity,可以插入订单项
                                let parms = res.map(i => {
                                    return [order_id, i.id, i.name, i.description, i.price, i.quantity, i.logo_img]
                                })
                                console.log(parms)
                                con.query('INSERT INTO sb_order_item \
                                (order_id,product_id,name,description,price,quantity,logo_img)\
                                VALUES ?', [parms], (err) => {
                                    if (err) {
                                        con.rollback(() => {
                                            console.log(err.message)
                                            con.release()
                                            resp.status(500).send()
                                            return
                                        })
                                    }
                                    con.commit((e) => {
                                        if (e) {
                                            con.rollback(() => {
                                                con.release();
                                                resp.json({ ret: 5, msg: "fail" })
                                            })
                                        } else {
                                            con.release()
                                            resp.json({ ret: 0, msg: "success" })
                                            return
                                        }
                                    })
                                })
                            }
                        })
                    }
                })
            }
        })
    })
})