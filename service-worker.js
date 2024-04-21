'use strict';

const LogLevel = {
    TRACE: 0,
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4,
    FATAL: 5,
    OFF: 6,
    UNKNOWN: 9
}
const _loggingLevel = LogLevel.TRACE;

/** 
 * @return {object} An associative array of functions that are based on console.log.
 * @note _logger().info('This is a test.');           //   [2023-04-05T06:07:08.090Z] [INFO] (service-worker)  This is a test.
 *       _logger().object({'a':1, 'b':2});            //   [2023-04-05T06:07:08.091Z] [INFO] (service-worker)  >{'a':1, 'b':2}
 *       _logger().debug('object: ', {'a':1, 'b':2}); //   [2023-04-05T06:07:08.092Z] [DEBUG] (service-worker)  object: >{'a':1, 'b':2}
 *       _logger().errobj(err);                       // x > [2023-04-05T06:07:08.093Z] [ERROR] (service-worker)  TypeError: Cannot read properties of ...
 *       _logger().fatal('', err);                    // x > [2023-04-05T06:07:08.094Z] [FATAL] (service-worker)  TypeError: Cannot read properties of ...
 */
var _logger = () => {
    return {
        trace: (() => {
            if(_loggingLevel <= LogLevel.TRACE){
                return console.debug.bind(console, '%s%s', '[' + (new Date).toJSON() + '] [TRACE] (service-worker)  ');
            }else{
                return () => {};
            };
        })(),
        debug: (() => {
            if(_loggingLevel <= LogLevel.DEBUG){
                return console.debug.bind(console, '%s%s', '[' + (new Date).toJSON() + '] [DEBUG] (service-worker)  ');
            }else{
                return () => {};
            };
        })(),
        log: (() => {
            if(_loggingLevel <= LogLevel.INFO){
                return console.info.bind (console, '%s%s', '[' + (new Date).toJSON() + '] [INFO] (service-worker)  ');
            }else{
                return () => {};
            };
        })(),
        object: (() => {
            if(_loggingLevel <= LogLevel.INFO){
                return console.info.bind (console, '%s%o', '[' + (new Date).toJSON() + '] [INFO] (service-worker)  ');
            }else{
                return () => {};
            };
        })(),
        info: (() => {
            if(_loggingLevel <= LogLevel.INFO){
                return console.info.bind (console, '%s%s', '[' + (new Date).toJSON() + '] [INFO] (service-worker)  ');
            }else{
                return () => {};
            };
        })(),
        warn: (() => {
            if(_loggingLevel <= LogLevel.WARN){
                return console.warn.bind (console, '%s%s', '[' + (new Date).toJSON() + '] [WARN] (service-worker)  ');
            }else{
                return () => {};
            };
        })(),
        error: (() => {
            if(_loggingLevel <= LogLevel.ERROR){
                return console.error.bind(console, '%s%s', '[' + (new Date).toJSON() + '] [ERROR] (service-worker)  ');
            }else{
                return () => {};
            };
        })(),
        fatal: (() => {
            if(_loggingLevel <= LogLevel.FATAL){
                return console.error.bind(console, '%s%s', '[' + (new Date).toJSON() + '] [FATAL] (service-worker)  ');
            }else{
                return () => {};
            };
        })()
    }
}

/** 
 * @param {string} key A string of the key.
 * @param {object} value An object of the data corresponding to the given key.
 * @return {Promise<boolean>} {@code true} if the set of the key and value are stored Chrome Local Storage without any problems. 
 */
async function _storeConfig(key, value){
    _logger().trace('_storeConfig() was called.');

    if(value === '' || value === null){
        value = '\'\''
    };

    let result = false;
    if(key !== null && typeof key === 'string'){
        await chrome.storage.local.set({[key]: value}).then(() => {
            _logger().info('config.' + key + ' was newly set to', value, '.');
    
            result = true;
        }).catch((error) => {
            _logger().error('Failed to set config.' + key + '. Reason:', error);
        });    
    };

    return result;
}


chrome.runtime.onInstalled.addListener(async ({reason}) => {
    if(reason === 'install'){
        _logger().trace('First time run process was started.');

        let initialValue = {
            'CONFIG_FUNCTION_DISABLE_WHOLE': false, 
            'CONFIG_UI_ADD_1000': true, 
            'CONFIG_UI_ADD_10000': false, 
            'CONFIG_UI_ADD_1DAY': true,
            'CONFIG_UI_ADD_7DAY': false, 
            'CONFIG_UI_ADD_ALL': true, 
            'CONFIG_UI_ADD_NEXT20': true, 
            'CONFIG_UI_ADD_NEXT100': true, 
            'CONFIG_AUTOMATION_ENABLE_AUTOFEEDBACK': true, 
            'CONFIG_AUTOMATION_FEEDBACK_DISLIKE': false, 
            'CONFIG_AUTOMATION_GOTO_LAST': false, 
            'CONFIG_TUNING_RANDOM_INTERVAL': false, 
            'CONFIG_TUNING_INCREASE_RANDOM': false, 
            'CONFIG_LOGGING_ENABLE_LOGGING': true,
            'CONFIG_LOGGING_ENABLE_DEBUGLOGGING': false
        };

        Object.keys(initialValue).forEach(async (optid) => {
            _logger().debug('config#' + optid + ' was set to ' + initialValue[optid] + '.');
            await _storeConfig(optid, initialValue[optid]);
        });
    };
});


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if(message.type == 'request' && message.op == 'open'){
        _logger().debug('Receive request(op:open) message#' + message.id + ' in the service worker.');

        chrome.tabs.create({url: message.url, active: false}).then(async (tab) => {
            let isProcessingVote = true;
            let msgId = 0;
            while(isProcessingVote){
                // Wait 1sec for the endpoint to establish the connection (=for content_script to register the message handler).
                await new Promise(resolve => setTimeout(resolve, 1000));

                msgId = Math.floor(Math.random()*10000);
                _logger().debug('Send request(op:vote) message#' + msgId + ' from the parent tab.');
                await chrome.tabs.sendMessage(tab.id, {id:msgId, type:'request', op:'vote'}).then(response => {
                    return Promise.resolve();
                });
    
                // Wait 1sec for the endpoint to establish the connection (=for content_script to register the message handler).
                await new Promise(resolve => setTimeout(resolve, 1000));

                msgId = Math.floor(Math.random()*10000);
                _logger().debug('Send request(op:close) message#' + msgId + ' from the parent tab.');
                await chrome.tabs.sendMessage(tab.id, {id:msgId, type:'request', op:'close'}).then(async (response) => {
                    if(response.op == 'ack'){
                        _logger().debug('Previous request(op:close) was acknowledged.');
                        isProcessingVote = false;
                    }else{
                        _logger().debug('Previous request(op:close) was unacknowledged. Restart to vote after 1sec.');
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    };

                    return Promise.resolve(response);
                });
            };

            // Make sure the handler (#1) has been registered before removing the child tab.
            chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
                if(tabId == tab.id && !isProcessingVote){
                    _logger().debug('Send response for request(op:open) message#' + message.id + ' in the service worker.');
                    sendResponse({id:message.id, type:'response', op:'ack'});
                };
            });

            return Promise.resolve(tab);
        }).then(async (tab) => {
            // Trigger the handler (#1).
            _logger().debug('Remove the child tab.');
            await chrome.tabs.remove(tab.id);

            return Promise.resolve();
        });
    }else{
        _logger().debug('Receive unknown message#' + message.id + ': ', message);
    };

    return true;
});



