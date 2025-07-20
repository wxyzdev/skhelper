'use strict';

/* ============================================ Modules ============================================ */
var jslogger, clstorage, logger;
async function loadModules () {
    if(typeof jslogger === 'undefined'){
        jslogger = (await import(chrome.runtime.getURL('jslogger.min.js')));
        await jslogger.setLogging(true);
        await jslogger.setApp(chrome.i18n.getMessage('APP_NAME'));
        await jslogger.setLevel('TRACE');
        await jslogger.setVivid(true);
        logger = jslogger.logger;
    };

    if(typeof clstorage === 'undefined'){
        clstorage = (await import(chrome.runtime.getURL('clstorage.min.js')));
        await clstorage.setLogging(true);
        await clstorage.setLevel('INFO');
    };

    Promise.resolve();
};

/* ========================================= Main process ========================================== */
// Launch the page observer after Window:load event.
window.addEventListener('load', async (event) => {
    // Load modules before any tasks.
    await loadModules();

    // Set Log Level.
    if(await clstorage.readConfig('CONFIG_LOGGING_ENABLE_DEBUGLOGGING')){
        jslogger.setLevel('DEBUG');
    }else if(await clstorage.readConfig('CONFIG_LOGGING_ENABLE_LOGGING')){
        jslogger.setLevel('INFO');
    }else{
        await jslogger.setLevel('NONE');
    };

    // Verify Disable Whole option at first
    if(await clstorage.readConfig('CONFIG_FUNCTION_DISABLE_WHOLE')){
        logger().info('Exit content_script.js since Disable Whole Option on all site is set to true.');
        return;
    };
    
    // Verify the event type to handle.
    logger().debug('Handling ' + ((event.target == document)?'document':'malformed window')
        + ' load event in the ' + ((window==window.parent)?'parent':'child') + ' frame.');
    if(event.target != document){
        logger().debug('A malformed window load event was ignored.');
        return;
    };


    // Skip vote button if auto-feedback is enabled.
    const autoFeedback = await clstorage.readConfig('CONFIG_AUTOMATION_ENABLE_AUTOFEEDBACK');
    const feedbackLabel = await clstorage.readConfig('CONFIG_AUTOMATION_FEEDBACK_DISLIKE')? '嫌い' : '好き';

    if(document.querySelectorAll('input.auth-r')){
        document.querySelectorAll('input.auth-r').forEach(async (feedbackButton) => {
            let voteButton = feedbackButton.parentElement.querySelector('button.vote-submit');
            if(voteButton.textContent.includes(feedbackLabel)){
                if(autoFeedback){
                    logger().info('Auto-feedback: ', voteButton);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    voteButton.click();
                };
            }
        });
    };

    let pageObserver = new MutationObserver((mutations) => {
        mutations.forEach(async (mutation) => {        
            if(mutation.target.classList.contains('auth-r') 
                && mutation.target.parentElement.querySelector('button.vote-submit').textContent.includes(feedbackLabel)){
                let voteButton = mutation.target.parentElement.querySelector('button.vote-submit');
                logger().debug('voteButton: ', voteButton);
                logger().debug('autoFeedback: ', autoFeedback);
                logger().debug('readConfig(): ', await clstorage.readConfig('CONFIG_AUTOMATION_ENABLE_AUTOFEEDBACK'));
                if(autoFeedback){
                    logger().info('Auto-feedback: ', voteButton);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    voteButton.click();
                };
            };
        });
    });
    pageObserver.observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ['value']
    });


    // Skip vote button when request(op:vote) message is received in the child window.
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if(message.type == 'request' && message.op == 'vote'){
            logger().debug('Receive request(op:vote) message#' + message.id + ' in the child tab.');

            if(document.querySelector('button.vote-submit') && !autoFeedback){
                logger().debug('Process the auto-feedback request.');

                document.querySelectorAll('button.vote-submit').forEach(async (button) => {
                    if(button.textContent.includes(feedbackLabel)){
                        let voteButton = button;
                        // Make sure the vote has completed before the current page is forwarded.
                        await (() => {
                            logger().debug('Send response for request(op:vote) message#' + message.id + ' from the child tab.');
                            sendResponse({id:message.id, type:'response', op:'ack'});
    
                            return Promise.resolve();
                        })();

                        // Then, send the response.
                        logger().info('Auto-feedback: ', voteButton);
                        voteButton.click();
                    };
                });
            }else{
                logger().debug('Send response for request(op:vote) message#' + message.id + ' from the child tab.');
                sendResponse({id:message.id, type:'response', op:'ack'});
            };
        }else if(message.type == 'request' && message.op == 'close'){
            logger().debug('Receive request(op:close) message#' + message.id + ' in the child tab.');

            if(document.querySelector('button.vote-submit')){
                // op:vote process may have not finished.
                logger().debug('Send deny for request(op:close) message#' + message.id + ' from the child tab.');
                sendResponse({id:message.id, type:'response', op:'deny'});
            }else{
                logger().debug('Send response for request(op:close) message#' + message.id + ' from the child tab.');
                sendResponse({id:message.id, type:'response', op:'ack'});
            };
        }else{
            logger().debug('Receive unknown message#' + message.id + ': ', message);
        };

        return true;
    });


    // Tuning and Automation parameters.
    const commentsPerPage = 20;
    const baseIntervalSec = 2;
    const hasRandomInterval = await clstorage.readConfig('CONFIG_TUNING_RANDOM_INTERVAL');
    const minRandomIntervalSec = 1;
    const maxRandomIntervalSec = 3;
    const hasRandomDelay = await clstorage.readConfig('CONFIG_TUNING_INCREASE_RANDOM');
    const maxRandomDelaySec = 5;
    let intervalSec = baseIntervalSec;
    let avgIntervalSec = baseIntervalSec;
    const isAutoTransition = await clstorage.readConfig('CONFIG_AUTOMATION_GOTO_LAST');

    // Scraping and save comments.
    let nextItemClassArray = document.querySelector('ul.pagination li:last-child').className.split(' ');
    let nextItemClass = nextItemClassArray[nextItemClassArray.length - 1];

    if(document.querySelector('li.' + nextItemClass)){
        // Add buttons to handle a user gesture for the file picker.
        let labels = ['LABEL_SAVE_1000','LABEL_SAVE_10000','LABEL_SAVE_1DAY','LABEL_SAVE_7DAY','LABEL_SAVE_ALL'];
        let upperPagination = document.querySelector('ul.pagination');
        await new Promise(async (resolve) => {
            for(let idx=0; idx<labels.length; idx++){
                if(await clstorage.readConfig('CONFIG_UI_ADD_' + labels[idx].replace(/LABEL_SAVE_/, ''))){
                    logger().debug('Add ' + chrome.i18n.getMessage(labels[idx]) + ' button.');
                    let item = document.createElement('li');
                    item.classList.add('page-item');
                    item.setAttribute('style', 'cursor:pointer;');
                    item.append(document.createElement('a'));
                    item.querySelector('a').classList.add('page-link');
                    item.querySelector('a').setAttribute('data-locale', labels[idx]);
                    item.querySelector('a').tabIndex = 0;
                    item.querySelector('a').id = 'SAVE-' + labels[idx].replace(/LABEL_SAVE_/, '');
                    item.querySelector('a').append(document.createTextNode(''));
                    upperPagination.append(item);
                };
            };
            resolve();
        }).then(() => {
            // Replace textContent if it has [data-locale="key"] tag:
            logger().trace('All of textContents were replaced.');
            document.querySelectorAll('[data-locale]').forEach(element => {
                element.textContent = chrome.i18n.getMessage(element.dataset.locale)
            });
        });

        // Trigger scraping by the click event on #SAVE-10+".
        document.querySelectorAll('ul.pagination li:has(a[id^="SAVE-10"]):has(a[id$="0"])').forEach((saveButton) => {
            saveButton.addEventListener('click', async (event) => {
                logger().info('Start scraping.');

                try{
                    logger().debug('Create a new writable file handler.')
                    const writableFileHandle = await window.showSaveFilePicker({types: [{description:'Text Files', accept:{'text/plain': ['.txt']}}]});
                    const writable = await writableFileHandle.createWritable();
                    logger().info('Save as ' + (await writableFileHandle.getFile()).webkitRelativePath + (await writableFileHandle.getFile()).name + '.');
    
                    let depth = event.target.id.replace(/^SAVE-/, '') / commentsPerPage;
                    let url = window.location.href;
                    let oldUrl = window.location.href;
                    let remain = 0;
                    let comments;
                    for (let idx=0; idx<depth; idx++){
                        // Calculate interval seconds before the request.
                        intervalSec = baseIntervalSec;
                        avgIntervalSec = baseIntervalSec;
                        if(hasRandomInterval){
                            intervalSec = minRandomIntervalSec + (Math.random()*(maxRandomIntervalSec-minRandomIntervalSec)); // [min-max] sec
                            avgIntervalSec = (maxRandomIntervalSec+minRandomIntervalSec)/2;
                        };
                        if(hasRandomDelay){
                            intervalSec = intervalSec + (Math.random()*maxRandomDelaySec); // +[0-5] sec
                            avgIntervalSec = avgIntervalSec + (maxRandomDelaySec/2);
                        };
                        intervalSec = Math.floor(intervalSec * 100) / 100; // x.xxxxx... -> x.xx
    
                        logger().info('Waiting for ' + intervalSec + ' sec to reduce cps...');
                        await new Promise(resolve => setTimeout(resolve, intervalSec*1000));
    
                        logger().info('Fetch the url: ', url);
                        await fetch(url).then(async (res) => {
                            // Return html.
                            return res.text();
                        }).then(async (html) => {
                            // Build DOM object from html.
                            let doc = new DOMParser().parseFromString(html, 'text/html');
    
                            logger().debug('Read and save the comments.');
                            comments = doc.querySelectorAll('div.comment-container');
                            for (let num=0; num<comments.length; num++){
                                let header = comments[num].querySelector('div.comment_info').textContent.replace(/\n/g, '');
                                let body = '';
                                comments[num].querySelectorAll('p.comment_body').forEach((p) => {
                                    body = body + p.textContent;
                                });
    
                                logger().debug(header + '\n' + body);
                                await writable.write(header + '\n' + body + '\n\n');
                            };
                            // Ignore a new vote process 

                            let hasNext = false;
                            if(doc.querySelector('li.' + nextItemClass + ' a')){
                                oldUrl = url;
                                url = doc.querySelector('li.' + nextItemClass + ' a').href;
                                remain = Number(url.replace(/^.*\?nxc=/, ''));
                                hasNext = true;
                            };
    
                            return hasNext;
                        }).then(async (result) => {
                            if(!result || remain <= 1){
                                // Do nothing if there is no comment.
                                logger().info('Complete saving approximately ' + idx*commentsPerPage + '+ comments.');
                                idx = depth-1;
                            }else if(idx+1 < depth && (idx+1)*commentsPerPage+remain >= depth*commentsPerPage){
                                logger().info('Estimated remaining download time: ' + (depth-idx-1)*avgIntervalSec + ' sec. (Progress: ' 
                                    + Math.floor((idx+1)/depth*1000)/10 + '% (' + (idx+1)*commentsPerPage + '/' + depth*commentsPerPage + '))');
                            }else if(idx+1 < depth && (idx+1)*commentsPerPage+remain < depth*commentsPerPage){
                                logger().info('Estimated remaining download time: ' + (Math.floor(remain/commentsPerPage)+1)*avgIntervalSec + ' sec. (Progress: ' 
                                    + Math.floor((idx+1)*commentsPerPage/((idx+1)*commentsPerPage+remain)*1000)/10 + '% (' + (idx+1)*commentsPerPage + '/' + ((idx+1)*commentsPerPage+remain) + '))');
                            }else{
                                logger().info('Complete saving ' + depth*commentsPerPage + ' comments.');
                            };
                       });
                    };
        
                    logger().debug('Close the writable file handler.')
                    await writable.close();
    
    
                    logger().info('Finished.   Filename: ' + (await writableFileHandle.getFile()).name);
                    event.target.blur();

                    if(isAutoTransition){
                        window.alert(chrome.i18n.getMessage('DIALOG_TASK_FINISHED') + ' ' +  chrome.i18n.getMessage('DIALOG_GOTO_LAST'));
                        logger().info('Jump to the last fetched page in ' + baseIntervalSec + ' sec: ' + oldUrl);
                        await new Promise(resolve => setTimeout(resolve, baseIntervalSec*1000));
                        window.location.href = oldUrl;
                    }else{
                        window.alert(chrome.i18n.getMessage('DIALOG_TASK_FINISHED'));
                    };
                }catch(error){
                    logger().error('Scraping was interrupted.\n', error);
                    event.target.blur();
                };
            });
        });


        // Trigger scraping by the click event on #SAVE-.*DAY".
        document.querySelectorAll('ul.pagination li:has(a[id^="SAVE-"]):has(a[id$="DAY"])').forEach((saveButton) => {
            saveButton.addEventListener('click', async (event) => {
                logger().info('Start scraping.');

                try{
                    logger().debug('Create a new writable file handler.')
                    const writableFileHandle = await window.showSaveFilePicker({types: [{description:'Text Files', accept:{'text/plain': ['.txt']}}]});
                    const writable = await writableFileHandle.createWritable();
                    logger().info('Save as ' + (await writableFileHandle.getFile()).webkitRelativePath + (await writableFileHandle.getFile()).name + '.');
    
                    let period = event.target.id.replace(/^SAVE-(\d)DAY/, '$1') * 24;  // [hour]
                    let latestDate = null;
                    let postDate = null;
                    let diff = 0; // [hour]
                    let url = window.location.href;
                    let oldUrl = window.location.href;
                    let remain = 0;
                    let savedComments = 0;
                    let comments;
                    while(diff <= period){
                        // Calculate interval seconds before the request.
                        intervalSec = baseIntervalSec;
                        avgIntervalSec = baseIntervalSec;
                        if(hasRandomInterval){
                            intervalSec = minRandomIntervalSec + (Math.random()*(maxRandomIntervalSec-minRandomIntervalSec)); // [min-max] sec
                            avgIntervalSec = (maxRandomIntervalSec+minRandomIntervalSec)/2;
                        };
                        if(hasRandomDelay){
                            intervalSec = intervalSec + (Math.random()*maxRandomDelaySec); // +[0-5] sec
                            avgIntervalSec = avgIntervalSec + (maxRandomDelaySec/2);
                        };
                        intervalSec = Math.floor(intervalSec * 100) / 100; // x.xxxxx... -> x.xx
    
                        logger().info('Waiting for ' + intervalSec + ' sec to reduce cps...');
                        await new Promise(resolve => setTimeout(resolve, intervalSec*1000));
    
                        logger().info('Fetch the url: ', url);
                        await fetch(url).then(async (res) => {
                            // Return html.
                            return res.text();
                        }).then(async (html) => {
                            // Build DOM object from html.
                            let doc = new DOMParser().parseFromString(html, 'text/html');
    
                            logger().debug('Read and save the comments.');
                            comments = doc.querySelectorAll('div.comment-container');
                            for (let num=0; num<comments.length; num++){
                                let header = comments[num].querySelector('div.comment_info').textContent.replace(/\n/g, '');
                                let body = '';
                                comments[num].querySelectorAll('p.comment_body').forEach((p) => {
                                    body = body + p.textContent;
                                });
    
                                if(latestDate == null){
                                    latestDate = new Date(header.replace(/.*(\d\d)-(\d\d) (\d\d):(\d\d).*/, new Date().getFullYear()+'-$1-$2T$3:00:00'));
                                };
                                postDate = new Date(header.replace(/.*(\d\d)-(\d\d) (\d\d):(\d\d).*/, new Date().getFullYear()+'-$1-$2T$3:00:00'));
                                if(latestDate.getTime() < postDate.getTime()){
                                    postDate = new Date(header.replace(/.*(\d\d)-(\d\d) (\d\d):(\d\d).*/, (new Date().getFullYear()-1)+'-$1-$2T$3:00:00'));
                                };
                                diff = Math.floor((latestDate.getTime() - postDate.getTime()) / (60*60*1000));
    
                                if(diff <= period){
                                    logger().debug(header + '\n' + body);
                                    await writable.write(header + '\n' + body + '\n\n');
                                    savedComments += 1;
                                };
                            };
                            // Ignore a new vote process 
    
                            let hasNext = false;
                            if(doc.querySelector('li.' + nextItemClass + 'a')){
                                oldUrl = url;
                                url = doc.querySelector('li.' + nextItemClass + ' a').href;
                                remain = Number(url.replace(/^.*\?nxc=/, ''));
                                hasNext = true;
                            };
    
                            return hasNext;
                        }).then(async (result) => {
                            if(!result || remain <= 1){
                                // Do nothing if there is no comment.
                                logger().info('Complete saving approximately ' + idx*commentsPerPage + ' comments.');
                                diff = period + 1;
                            }else if(diff <= period){
                                logger().info('Estimated remaining download time: ' + Math.min(
                                        Math.floor(((period-diff)*savedComments/diff)/commentsPerPage), 
                                        Math.floor(remain/commentsPerPage)+1
                                    )*avgIntervalSec + ' sec. (Progress: ' 
                                    + Math.floor(diff/period*1000)/10 + '% (' + diff + 'h/' + period + 'h))');
                            }else{
                                logger().info('Complete saving ' + savedComments + ' comments for ' + period + ' hours.');
                            };
                       });
                    };
        
                    logger().debug('Close the writable file handler.')
                    await writable.close();
    
    
                    logger().info('Finished.   Filename: ' + (await writableFileHandle.getFile()).name);
                    event.target.blur();


                    if(isAutoTransition){
                        window.alert(chrome.i18n.getMessage('DIALOG_TASK_FINISHED') + ' ' +  chrome.i18n.getMessage('DIALOG_GOTO_LAST'));
                        logger().info('Jump to the last fetched page in ' + baseIntervalSec + ' sec: ' + oldUrl);
                        await new Promise(resolve => setTimeout(resolve, baseIntervalSec*1000));
                        window.location.href = oldUrl;
                    }else{
                        window.alert(chrome.i18n.getMessage('DIALOG_TASK_FINISHED'));
                    };
                }catch(error){
                    logger().error('Scraping was interrupted.\n', error);
                    event.target.blur();
                };
            });
        });


        // Trigger scraping by the click event on #SAVE-ALL".
        document.querySelectorAll('ul.pagination li:has(a[id="SAVE-ALL"])').forEach((saveButton) => {
            saveButton.addEventListener('click', async (event) => {
                logger().info('Start scraping.');

                try{
                    logger().debug('Create a new writable file handler.')
                    const writableFileHandle = await window.showSaveFilePicker({types: [{description:'Text Files', accept:{'text/plain': ['.txt']}}]});
                    const writable = await writableFileHandle.createWritable();
                    logger().info('Save as ' + (await writableFileHandle.getFile()).webkitRelativePath + (await writableFileHandle.getFile()).name + '.');
    
                    let url = window.location.href;
                    let oldUrl = window.location.href;
                    let remain = 0;
                    let savedComments = 0;
                    let comments;
                    while(savedComments == 0 || remain > 1){
                        // Calculate interval seconds before the request.
                        intervalSec = baseIntervalSec;
                        avgIntervalSec = baseIntervalSec;
                        if(hasRandomInterval){
                            intervalSec = minRandomIntervalSec + (Math.random()*(maxRandomIntervalSec-minRandomIntervalSec)); // [min-max] sec
                            avgIntervalSec = (maxRandomIntervalSec+minRandomIntervalSec)/2;
                        };
                        if(hasRandomDelay){
                            intervalSec = intervalSec + (Math.random()*maxRandomDelaySec); // +[0-5] sec
                            avgIntervalSec = avgIntervalSec + (maxRandomDelaySec/2);
                        };
                        intervalSec = Math.floor(intervalSec * 100) / 100; // x.xxxxx... -> x.xx
    
                        logger().info('Waiting for ' + intervalSec + ' sec to reduce cps...');
                        await new Promise(resolve => setTimeout(resolve, intervalSec*1000));
    
                        logger().info('Fetch the url: ', url);
                        await fetch(url).then(async (res) => {
                            // Return html.
                            return res.text();
                        }).then(async (html) => {
                            // Build DOM object from html.
                            let doc = new DOMParser().parseFromString(html, 'text/html');
    
                            logger().debug('Read and save the comments.');
                            comments = doc.querySelectorAll('div.comment-container');
    
                            if(comments.length > 0){
                                for (let num=0; num<comments.length; num++){
                                    let header = comments[num].querySelector('div.comment_info').textContent.replace(/\n/g, '');
                                    let body = '';
                                    comments[num].querySelectorAll('p.comment_body').forEach((p) => {
                                        body = body + p.textContent;
                                    });
        
                                    logger().debug(header + '\n' + body);
                                    await writable.write(header + '\n' + body + '\n\n');
                                    savedComments += 1;
                                };
                            }else if(comments.length == 0 && doc.querySelector('button.vote-submit')){
                                logger().info('Open the new tab in the background since a new vote is required.');
    
                                let msgId = Math.floor(Math.random()*10000);
                                logger().debug('Send request(op:open) message#' + msgId + ' from the parent tab.');
                                await chrome.runtime.sendMessage({id:msgId, type:'request', op:'open', url:url}).then(response => {
                                    logger().debug('Receive response for request(op:open) message#' + response.id + ' in the parent tab.');
                                });
                            };
    
                            let hasNext = false;
                            if(comments.length > 0 && doc.querySelector('li.' + nextItemClass + ' a')){
                                oldUrl = url;
                                url = doc.querySelector('li.' + nextItemClass + ' a').href;
                                remain = Number(url.replace(/^.*\?nxc=/, ''));
                                hasNext = true;
                            };
    
                            return hasNext;
                        }).then(async (result) => {
                            if(!result || remain <= 1){
                                // Do nothing if there is no comment.
                                logger().info('Complete saving ' + savedComments + ' comments.');
                            }else{
                                logger().info('Estimated remaining download time: ' 
                                    + (Math.floor(remain/commentsPerPage)+1)*avgIntervalSec + ' sec. (Progress: ' 
                                    + Math.floor(savedComments/(savedComments+remain)*1000)/10 + '% (' + savedComments + '/' + (savedComments+remain) + '))');
                            };
                       });
                    };
        
                    logger().debug('Close the writable file handler.')
                    await writable.close();
    
    
                    logger().info('Finished.   Filename: ' + (await writableFileHandle.getFile()).name);
                    event.target.blur();
    
                    
                    if(isAutoTransition){
                        window.alert(chrome.i18n.getMessage('DIALOG_TASK_FINISHED') + ' ' +  chrome.i18n.getMessage('DIALOG_GOTO_LAST'));
                        logger().info('Jump to the last fetched page in ' + baseIntervalSec + ' sec: ' + oldUrl);
                        await new Promise(resolve => setTimeout(resolve, baseIntervalSec*1000));
                        window.location.href = oldUrl;
                    }else{
                        window.alert(chrome.i18n.getMessage('DIALOG_TASK_FINISHED'));
                    };
                }catch(error){
                    logger().error('Scraping was interrupted.\n', error);
                    event.target.blur();
                };
            });
        });
    };


    // Pre-load next comments.
    if(document.querySelector('ul.pagination:not(:has(li.page-item:not(.first-page):not(.prev-page):not(.' + nextItemClass + '))) li.' + nextItemClass + '')){
        // Add buttons to handle a user gesture for the file picker.
        let labels = ['LABEL_PRELOAD_NEXT20','LABEL_PRELOAD_NEXT100'];
        let lowerPagination = document.querySelector('ul.pagination:not(:has(li.page-item:not(.first-page):not(.prev-page):not(.' + nextItemClass + ')))');
        await new Promise(async (resolve) => {
            for(let idx=0; idx<labels.length; idx++){
                if(await clstorage.readConfig('CONFIG_UI_ADD_' + labels[idx].replace(/LABEL_PRELOAD_/, ''))){
                    logger().debug('Add ' + chrome.i18n.getMessage(labels[idx]) + ' button.');
                    let item = document.createElement('li');
                    item.classList.add('page-item');
                    item.setAttribute('style', 'cursor:pointer;');
                    item.append(document.createElement('a'));
                    item.querySelector('a').classList.add('page-link');
                    item.querySelector('a').setAttribute('data-locale', labels[idx]);
                    item.querySelector('a').tabIndex = 0;
                    item.querySelector('a').id = 'PRELOAD-' + labels[idx].replace(/LABEL_PRELOAD_NEXT/, '');
                    item.querySelector('a').append(document.createTextNode(''));
                    lowerPagination.append(item);
                };
            };
            resolve();
        }).then(() => {
            // Replace textContent if it has [data-locale="key"] tag:
            logger().trace('All of textContents were replaced.');
            lowerPagination.querySelectorAll('[data-locale]').forEach(element => {
                element.textContent = chrome.i18n.getMessage(element.dataset.locale)
            });
        });


        // Trigger scraping by the click event on #PRELOAD-".
        lowerPagination.querySelectorAll('ul.pagination li:has(a[id^="PRELOAD-"])').forEach((preloadButton) => {
            preloadButton.addEventListener('click', async (event) => {
                logger().info('Start preloading.');
                document.querySelector('html body').setAttribute('style', 'cursor:progress;');
                lowerPagination.querySelectorAll('ul.pagination li:has(a[id^="PRELOAD-"])').forEach((btn) => {
                    btn.setAttribute('style', 'cursor:progress;pointer-events:none;');
                });


                let depth = event.target.id.replace(/^PRELOAD-/, '') / commentsPerPage;
                let url = lowerPagination.querySelector('li.' + nextItemClass + ' a').href;
                let remain = 0;
                let comments;

                for (let idx=0; idx<depth; idx++){
                    // Calculate interval seconds before the request.
                    intervalSec = baseIntervalSec;
                    avgIntervalSec = baseIntervalSec;
                    if(hasRandomInterval){
                        intervalSec = minRandomIntervalSec + (Math.random()*(maxRandomIntervalSec-minRandomIntervalSec)); // [min-max] sec
                        avgIntervalSec = (maxRandomIntervalSec+minRandomIntervalSec)/2;
                    };
                    if(hasRandomDelay){
                        intervalSec = intervalSec + (Math.random()*maxRandomDelaySec); // +[0-10] sec
                        avgIntervalSec = avgIntervalSec + (maxRandomDelaySec/2);
                    };
                    intervalSec = Math.floor(intervalSec * 100) / 100; // x.xxxxx... -> x.xx

                    logger().info('Waiting for ' + intervalSec + ' sec to reduce cps...');
                    await new Promise(resolve => setTimeout(resolve, intervalSec*1000));

                    logger().info('Fetch the url: ', url);
                    await fetch(url).then(async (res) => {
                        // Return html.
                        return res.text();
                    }).then(async (html) => {
                        // Build DOM object from html.
                        let doc = new DOMParser().parseFromString(html, 'text/html');

                        logger().debug('Load and insert the next comments.');
                        comments = doc.querySelectorAll('div.comment-container');

                        if(comments.length > 0){
                            doc.querySelectorAll('div.comment.container > *').forEach((elm) => {
                                document.querySelector('div.comment.container').append(elm);
                                if(elm.classList.contains('comment-container')){
                                    let note = document.createTextNode(chrome.i18n.getMessage('LABEL_COMMENT_NOTE'))
                                    elm.querySelector('div.comment_info').append(note);
                                };
                            });
                        };
                        // Ignore a new vote process 

                        let hasNext = false;
                        if(comments.length > 0 && doc.querySelector('li.' + nextItemClass + ' a')){
                            url = doc.querySelector('li.' + nextItemClass + ' a').href;
                            remain = Number(url.replace(/^.*\?nxc=/, ''));
                            hasNext = true;
                        };

                        return hasNext;
                    }).then(async (result) => {
                        if(!result || remain <= 1){
                            // Do nothing if there is no comment.
                            logger().info('Complete loading approximately ' + idx*commentsPerPage + '+ next comments.');
                            idx = depth-1;
                        }else if(idx+1 < depth && (idx+1)*commentsPerPage+remain >= depth*commentsPerPage){
                            logger().info('Estimated remaining loading time: ' + (depth-idx-1)*avgIntervalSec + ' sec. (Progress: ' 
                                + Math.floor((idx+1)/depth*1000)/10 + '% (' + (idx+1)*commentsPerPage + '/' + depth*commentsPerPage + '))');
                        }else if(idx+1 < depth && (idx+1)*commentsPerPage+remain < depth*commentsPerPage){
                            logger().info('Estimated remaining loading time: ' + (Math.floor(remain/commentsPerPage)+1)*avgIntervalSec + ' sec. (Progress: ' 
                                + Math.floor((idx+1)*commentsPerPage/((idx+1)*commentsPerPage+remain)*1000)/10 + '% (' + (idx+1)*commentsPerPage + '/' + ((idx+1)*commentsPerPage+remain) + '))');
                        }else{
                            logger().info('Complete loading ' + depth*commentsPerPage + ' comments.');
                        };
                   });
                };

                
                logger().info('Preloaded the next comments.');


                event.target.blur();
                document.querySelector('html body').removeAttribute('style');
                lowerPagination.querySelectorAll('ul.pagination li:has(a[id^="PRELOAD-"])').forEach((btn) => {
                    btn.setAttribute('style', 'cursor:pointer;');
                });

                await new Promise(resolve => {
                    lowerPagination.querySelector('li.' + nextItemClass + ' a').href = url;
                    lowerPagination.querySelector('li.' + nextItemClass + ' a').setAttribute('data-locale', 'LABEL_NEXT_PRELOAD');
                    resolve();
                }).then(() => {
                    // Replace textContent if it has [data-locale="key"] tag:
                    logger().trace('All of textContents were replaced.');
                    lowerPagination.querySelectorAll('li.' + nextItemClass + ' a[data-locale]').forEach(element => {
                        element.textContent = chrome.i18n.getMessage(element.dataset.locale)
                    });
                });
            });
        });
    }

}); 
