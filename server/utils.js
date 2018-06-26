const moment = require('moment');

class Utils {
    static printLog(msg)
    {
        console.log(Utils.getDate()+': '+msg);
    }
    
    static getDate()
    {
        return moment().format('YYYY-MM-DD HH:mm:ss');
    }
}

module.exports = Utils;
