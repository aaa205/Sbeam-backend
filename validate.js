const joi = require('@hapi/joi')
const register = joi.object({
    name: joi.string()
        .min(2)
        .max(8)
        .required(),
    password: joi.string()
        .pattern(/^[a-zA-Z0-9]{3,30}$/).required(),
    repeat_password: joi.ref('password'),
    email: joi.string()
        .email({ minDomainSegments: 2, tlds: { allow: ['com', 'net'] } }).required()
})
const login = joi.object({
    email: joi.string()
        .email({ minDomainSegments: 2, tlds: { allow: ['com', 'net'] } }).required(),
    password: joi.string()
        .pattern(/^[a-zA-Z0-9]{3,30}$/).required(),
})
const cartAdd=joi.object({
    product_id:joi.number().required(),
    quantity:joi.number().required()
})
const asynUpdate=joi.object({
    product_id:joi.number().required(),
    quantity:joi.number().required(),
    type:joi.string().required()
})
module.exports = {
    register,login,cartAdd,asynUpdate
}