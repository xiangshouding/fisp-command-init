/**
 * fis.baidu.com
 */

'use strict';

var spawn = require('child_process').spawn;
var path = require('path');

fis.scaffold = require('./lib/scaffold.js');

exports.name = 'init';
exports.usage = '<command> [options]';
exports.desc = 'A awesome scaffold of fis';
exports.register = function(commander) {
    var o_args = process.argv;
    
    var scaffold = require('fis-scaffold-' + get_scaffold(o_args));

    commander
        .option('-s, --scaffold <scaffold>', '', String, 'pc')
        .option('-d, --dir <name>', 'create to dir', require('path').resolve, process.cwd())
        .option('--with-plugin', 'if create a module, whether include `plugin`', Boolean, false)
        .option('--repos <url>', 'repository', String, 'http://lightjs.duapp.com')
        .option('--verbose', 'output verbose help', Boolean, false)
        .option('--list [query]', 'list component from the repos');

    commander
        .command('module')
        .description('create a module');

    commander
        .command('widget')
        .description('create a widget'); 
    
    if (scaffold.command) {
        scaffold.command(commander);
    }
    
    commander.action(function () {

            var args = Array.prototype.slice.call(arguments);
            var options = args.pop();
            var cmd = args.shift();
            var colors = require('colors');

            if (options.verbose) {
                fis.log.level = fis.log.L_ALL;
                fis.log.throw = true;
            }

            scaffold = require('fis-scaffold-' + options.scaffold)(options);
            
            if (options.list) {
                if (scaffold.list) {
                    scaffold.list(options);
                } else {
                    fis.scaffold.list(options);
                }
                return;
            }

            check_dir(options.dir);

            switch(cmd) {
                case 'module':
                    scaffold.module();
                    break;
                case 'widget':
                    scaffold.widget();
                    break;
                default:
                    if (typeof(cmd) == 'undefined') {
                        init_env();
                        return;
                    }

                    if (scaffold.download) {
                        //脚手架不用lights平台
                        scaffold.download(cmd, options);
                    } else if (scaffold[cmd] && fis.util.is(scaffold[cmd], 'Function')) {
                        scaffold[cmd](options);
                    } else {
                        fis.scaffold.download(cmd, options.dir, {url: options.repos});
                    }

                    break;
            }
        });
};

function get_scaffold(args) {
    var p_short = args.indexOf('-s');
    var p = args.indexOf('--scaffold');

    if (p_short != -1) {
        return args[p_short+1];
    }

    if (p != -1) {
        return args[p+1];
    }

    return 'pc';
}

//安装fis-conf.js里面配置的插件
function init_env() {
    var conf = get_conf();
    if (conf) {
        //只获取用户配置文件中的插件
        fis.config.set('modules', {});
        require(conf);
        var modules = fis.config.get('modules');
        var requires = [];
        fis.util.map(modules, function (type, info) {
            if (['parser', 'preprocessor', 'postprocessor', 'test', 'lint', 'optimizer'].indexOf(type) != -1) {
                fis.util.map(info, function (ext, reqs) {
                    requires = requires.concat(get_reqs(type, reqs));
                });
            } else if (['prepackager', 'packager', 'postpackager', 'spriter'].indexOf(type) != -1) {
                var reqs = info;
                requires = requires.concat(get_reqs(type, reqs));
            }
        });
        var need_install = check_env(requires);
        for (var i = 0, len = need_install.length; i < len; i++) {
            //npm 安装需要的插件
            npm_install(need_install[i]);
        }
    }
}

function check_env(requires) {
    var need = [];
    for (var i = 0, len = requires.length; i < len; i++) {
        try {
            require(requires[i]);
        } catch (e) {
            need.push(requires[i]);
        }
    }
    return need;
}

function get_reqs(type, reqs) {
    if (fis.util.is(reqs, 'Function') || !reqs) {
        return [];
    }

    if (fis.util.is(reqs, 'String')) {
        reqs = reqs.split(',');
    }

    var requires = [];
    reqs = reqs.filter(function (comp) {
        if (fis.util.is(comp, 'String')) {
            return true;
        }
        return false;
    });

    for (var i = 0, len = reqs.length; i < len; i++) {
        requires.push('fis-'+type+'-'+reqs[i].trim());
    }

    return requires;
}

//获取fis-conf.js
function get_conf() {
    var root = fis.util.realpath(process.cwd()), filename="fis-conf.js", conf;

    //try to find fis-conf.js
    var cwd = root, pos = cwd.length;
    do {
        cwd  = cwd.substring(0, pos);
        conf = cwd + '/' + filename;
        if(fis.util.exists(conf)){
            root = cwd;
            break;
        } else {
            conf = false;
            pos = cwd.lastIndexOf('/');
        }
    } while(pos > 0);

    return conf;
}

function npm_install(comp) {

    var cmd = process.platform == 'win32' ? 'npm.cmd' : 'npm';
    
    console.log(cmd);

    var npm = spawn(cmd, ['install', comp, '-g'], {detach: true});

    npm.stdout.pipe(process.stdout);
    npm.stderr.pipe(process.stderr);
    npm.on('error', function (e) {
        throw e;
    });
}

function check_dir(dir) {
    dir = path.resolve(dir);
    if (fis.util.fs.existsSync(dir) && process.cwd() != dir) {
        fis.log.error('the directory has already exist, the process will stop.');        
    }
}
