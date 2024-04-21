'use strict';

var jslogger, clstorage;
async function loadModules () {
    if(typeof jslogger === 'undefined'){
        jslogger = (await import(chrome.runtime.getURL("jslogger.min.js")));
        await jslogger.setLogging(true);
        await jslogger.setApp(chrome.i18n.getMessage('APP_NAME'));
        await jslogger.setLevel('TRACE');
        await jslogger.setVivid(true);    
    };

    if(typeof clstorage === 'undefined'){
        clstorage = (await import(chrome.runtime.getURL("clstorage.min.js")));
        await clstorage.setLogging(true);
        await clstorage.setLevel('DEBUG');
    };

    Promise.resolve();
};

window.addEventListener('load', async (event) => {
    await loadModules();

    // Prepare the page layout
    initLayout(document.querySelector('html body'));

    // Build overlay minicard
    addAbout(document.querySelector('div.overlay'));

    // Build header
    addLogo(document.querySelector('div.header-container'), '#', './icons/icon-32.png');
    addTitle(document.querySelector('div.header-container'), 'APP_NAME');
    addActionIcon(document.querySelector('div.header-container'), 'icon-hamburger', 'HAMBURGER');
    addItemToActionIconPopup(document.querySelector('div.header-container div.header-icon#' + 'HEADER_ICON_HAMBURGER'), 'RESET', '');
    addItemToActionIconPopup(document.querySelector('div.header-container div.header-icon#' + 'HEADER_ICON_HAMBURGER'), 'CLEAR', '');
    addItemToActionIconPopup(document.querySelector('div.header-container div.header-icon#' + 'HEADER_ICON_HAMBURGER'), 'REPORT', 'icon-open');
    addItemToActionIconPopup(document.querySelector('div.header-container div.header-icon#' + 'HEADER_ICON_HAMBURGER'), '', 'hr');
    addItemToActionIconPopup(document.querySelector('div.header-container div.header-icon#' + 'HEADER_ICON_HAMBURGER'), 'ABOUT', '');

    // Build body
    appendOptionItem(document.querySelector('div.option-container'), '', '', 'hr');
    appendOption(document.querySelector('div.option-container'), 'FUNCTION');
    appendOptionItem(document.querySelector('div.option-container'), 'FUNCTION', 'DISABLE_WHOLE', '');
    appendOptionItem(document.querySelector('div.option-container'), '', '', 'hr');
    appendOption(document.querySelector('div.option-container'), 'UI');
    appendOptionItem(document.querySelector('div.option-container'), 'UI', 'ADD_1000', '');
    appendOptionItem(document.querySelector('div.option-container'), 'UI', 'ADD_10000', '');
    appendOptionItem(document.querySelector('div.option-container'), 'UI', 'ADD_1DAY', '');
    appendOptionItem(document.querySelector('div.option-container'), 'UI', 'ADD_7DAY', '');
    appendOptionItem(document.querySelector('div.option-container'), 'UI', 'ADD_ALL', '');
    appendOptionItem(document.querySelector('div.option-container'), 'UI', 'ADD_NEXT20', '');
    appendOptionItem(document.querySelector('div.option-container'), 'UI', 'ADD_NEXT100', '');
    appendOptionItem(document.querySelector('div.option-container'), '', '', 'hr');
    appendOption(document.querySelector('div.option-container'), 'AUTOMATION');
    appendOptionItem(document.querySelector('div.option-container'), 'AUTOMATION', 'ENABLE_AUTOFEEDBACK', '');
    appendOptionItem(document.querySelector('div.option-container'), 'AUTOMATION', 'FEEDBACK_DISLIKE', '');
    appendOptionItem(document.querySelector('div.option-container'), 'AUTOMATION', 'GOTO_LAST', '');
    appendOptionItem(document.querySelector('div.option-container'), '', '', 'hr');
    appendOption(document.querySelector('div.option-container'), 'TUNING');
    appendOptionItem(document.querySelector('div.option-container'), 'TUNING', 'RANDOM_INTERVAL', '');
    appendOptionItem(document.querySelector('div.option-container'), 'TUNING', 'INCREASE_RANDOM', '');
    appendOptionItem(document.querySelector('div.option-container'), '', '', 'hr');
    appendOption(document.querySelector('div.option-container'), 'LOGGING');
    appendOptionItem(document.querySelector('div.option-container'), 'LOGGING', 'ENABLE_LOGGING', '');
    appendOptionItem(document.querySelector('div.option-container'), 'LOGGING', 'ENABLE_DEBUGLOGGING', '');

    // Replace textContent if it has [data-locale="key"] tag:
    jslogger.logger().trace('All of textContents were replaced.');
    document.querySelectorAll('[data-locale]').forEach(element => {
        element.textContent = chrome.i18n.getMessage(element.dataset.locale)
    });

    // Read the latest configs and reflect current configs on items.
    reflectConfigs();

    // Add EventListener to events.
    registerEventListenerOnOverlayScreen();
    registerEventListenerOnMenuButtons();
    registerEventListenerOnToggleSwitches();
})

function reflectConfigs(){
    jslogger.logger().trace('reflectConfigs() was called.');

    document.querySelectorAll('div.toggleswitch input[type=checkbox]').forEach(async (togglesw) => {
        togglesw.checked = await clstorage.readConfig(togglesw.id);
    });
}

/* 
 *  <body>
 *    <div class="overlay"></div>
 *    <div class="header-container"></div>
 *    <div class="option-container"></div>
 *  </body>
 */ 
function initLayout(target){
    jslogger.logger().trace('initLayout() was called.');
    
    let overlay = document.createElement('div');
    overlay.classList.add('overlay');
    target.appendChild(overlay);

    let header = document.createElement('div');
    header.classList.add('header-container');
    target.appendChild(header);

    let option = document.createElement('div');
    option.classList.add('option-container');
    target.appendChild(option);
};

/* 
 *  <div class="overlay">
 *    <div class="overlay-minicard" id="OVERLAY_CARD_ABOUT">
 *      <div class="overlay-minicard-close" id="OVERLAY_CARD_ABOUT_CLOSE"><span class="overlay-minicard-close-symbol"></span></div>
 *      <div class="overlay-minicard-row" id="OVERLAY_CARD_ABOUT_NAME">
 *        <div class="overlay-minicard-title"><span data-locale="APP_NAME"></span></div>
 *      </div>
 *      <div class="overlay-minicard-row" id="OVERLAY_CARD_ABOUT_VERSION">
 *        <div class="overlay-minicard-name"><span>Version</span></div>
 *        <div class="overlay-minicard-value"><span data-locale="APP_VERSION"></span></div>
 *      </div>
 *      <div class="overlay-minicard-row" id="OVERLAY_CARD_ABOUT_LICENSE">
 *        <div class="overlay-minicard-name"><span>License</span></div>
 *        <div class="overlay-minicard-value"><span data-locale="APP_LICENSE"></span></div>
 *      </div>
 *      <div class="overlay-minicard-row" id="OVERLAY_CARD_ABOUT_COPYRIGHT">
 *        <div class="overlay-minicard-name"><span>Copyright</span></div>
 *        <div class="overlay-minicard-value"><span data-locale="APP_COPYRIGHT"></span></div>
 *      </div>
 *      <div class="overlay-minicard-row" id="OVERLAY_CARD_ABOUT_CONTACT">
 *        <div class="overlay-minicard-name"><span>Contact</span></div>
 *        <div class="overlay-minicard-value"><span data-locale="APP_CONTACT"></span></div>
 *      </div>
 *    </div>
 *  </div>
 */ 
function addAbout(target){
    jslogger.logger().trace('addAbout() was called.');

    let card = document.createElement('div');
    card.classList.add('overlay-minicard');
    card.classList.add('hidden');
    card.id = 'OVERLAY_CARD_ABOUT';

    card.appendChild(document.createElement('div'));
    card.querySelector(':scope > div:not([id])').classList.add('overlay-minicard-close');
    card.querySelector(':scope > div:not([id])').id = card.id + '_CLOSE';
    card.querySelector('div#' + card.id + '_CLOSE').appendChild(document.createElement('span'));
    card.querySelector('div#' + card.id + '_CLOSE span').classList.add('overlay-minicard-close-symbol');

    card.appendChild(document.createElement('div'));
    card.querySelector(':scope > div:not([id])').classList.add('overlay-minicard-row');
    card.querySelector(':scope > div:not([id])').id = card.id + '_NAME';
    card.querySelector('div#' + card.id + '_NAME').appendChild(document.createElement('div'));
    card.querySelector('div#' + card.id + '_NAME div').classList.add('overlay-minicard-title');
    card.querySelector('div#' + card.id + '_NAME div.overlay-minicard-title').appendChild(document.createElement('span'));
    card.querySelector('div#' + card.id + '_NAME div.overlay-minicard-title span').setAttribute('data-locale', 'APP_NAME');

    card.appendChild(document.createElement('div'));
    card.querySelector(':scope > div:not([id])').classList.add('overlay-minicard-row');
    card.querySelector(':scope > div:not([id])').id = card.id + '_VERSION';
    card.querySelector('div#' + card.id + '_VERSION').appendChild(document.createElement('div'));
    card.querySelector('div#' + card.id + '_VERSION div').classList.add('overlay-minicard-name');
    card.querySelector('div#' + card.id + '_VERSION div.overlay-minicard-name').appendChild(document.createElement('span'));
    card.querySelector('div#' + card.id + '_VERSION div.overlay-minicard-name span').textContent = 'Version';
    card.querySelector('div#' + card.id + '_VERSION').appendChild(document.createElement('div'));
    card.querySelector('div#' + card.id + '_VERSION div:not(.overlay-minicard-name)').classList.add('overlay-minicard-value');
    card.querySelector('div#' + card.id + '_VERSION div.overlay-minicard-value').appendChild(document.createElement('span'));
    card.querySelector('div#' + card.id + '_VERSION div.overlay-minicard-value span').setAttribute('data-locale', 'APP_VERSION');

    card.appendChild(document.createElement('div'));
    card.querySelector(':scope > div:not([id])').classList.add('overlay-minicard-row');
    card.querySelector(':scope > div:not([id])').id = card.id + '_LICENSE';
    card.querySelector('div#' + card.id + '_LICENSE').appendChild(document.createElement('div'));
    card.querySelector('div#' + card.id + '_LICENSE div').classList.add('overlay-minicard-name');
    card.querySelector('div#' + card.id + '_LICENSE div.overlay-minicard-name').appendChild(document.createElement('span'));
    card.querySelector('div#' + card.id + '_LICENSE div.overlay-minicard-name span').textContent = 'License';
    card.querySelector('div#' + card.id + '_LICENSE').appendChild(document.createElement('div'));
    card.querySelector('div#' + card.id + '_LICENSE div:not(.overlay-minicard-name)').classList.add('overlay-minicard-value');
    let license = document.createElement('a');
    license.href = chrome.i18n.getMessage('APP_LICENSE_URL');
    license.setAttribute('target', '_blank');
    license.appendChild(document.createElement('span'));
    license.querySelector('span').setAttribute('data-locale', 'APP_LICENSE');
    card.querySelector('div#' + card.id + '_LICENSE div.overlay-minicard-value').appendChild(license);

    card.appendChild(document.createElement('div'));
    card.querySelector(':scope > div:not([id])').classList.add('overlay-minicard-row');
    card.querySelector(':scope > div:not([id])').id = card.id + '_COPYRIGHT';
    card.querySelector('div#' + card.id + '_COPYRIGHT').appendChild(document.createElement('div'));
    card.querySelector('div#' + card.id + '_COPYRIGHT div').classList.add('overlay-minicard-name');
    card.querySelector('div#' + card.id + '_COPYRIGHT div.overlay-minicard-name').appendChild(document.createElement('span'));
    card.querySelector('div#' + card.id + '_COPYRIGHT div.overlay-minicard-name span').textContent = 'Copyright';
    card.querySelector('div#' + card.id + '_COPYRIGHT').appendChild(document.createElement('div'));
    card.querySelector('div#' + card.id + '_COPYRIGHT div:not(.overlay-minicard-name)').classList.add('overlay-minicard-value');
    card.querySelector('div#' + card.id + '_COPYRIGHT div.overlay-minicard-value').appendChild(document.createElement('span'));
    card.querySelector('div#' + card.id + '_COPYRIGHT div.overlay-minicard-value span').setAttribute('data-locale', 'APP_COPYRIGHT');

    card.appendChild(document.createElement('div'));
    card.querySelector(':scope > div:not([id])').classList.add('overlay-minicard-row');
    card.querySelector(':scope > div:not([id])').id = card.id + '_CONTACT';
    card.querySelector('div#' + card.id + '_CONTACT').appendChild(document.createElement('div'));
    card.querySelector('div#' + card.id + '_CONTACT div').classList.add('overlay-minicard-name');
    card.querySelector('div#' + card.id + '_CONTACT div.overlay-minicard-name').appendChild(document.createElement('span'));
    card.querySelector('div#' + card.id + '_CONTACT div.overlay-minicard-name span').textContent = 'Contact';
    card.querySelector('div#' + card.id + '_CONTACT').appendChild(document.createElement('div'));
    card.querySelector('div#' + card.id + '_CONTACT div:not(.overlay-minicard-name)').classList.add('overlay-minicard-value');

    card.querySelector('div#' + card.id + '_CONTACT div.overlay-minicard-value').appendChild(document.createElement('div'));
    let github = document.createElement('a');
    github.href = chrome.i18n.getMessage('APP_CONTACT_GITHUB_URL');
    github.setAttribute('target', '_blank');
    github.appendChild(document.createElement('span'));
    github.querySelector('span').setAttribute('data-locale', 'APP_CONTACT_GITHUB');
    card.querySelector('div#' + card.id + '_CONTACT div.overlay-minicard-value div').appendChild(github);
    card.querySelector('div#' + card.id + '_CONTACT div.overlay-minicard-value div').appendChild(document.createTextNode(' , '));
    let twitter = document.createElement('a');
    twitter.href = chrome.i18n.getMessage('APP_CONTACT_TWITTER_URL');
    twitter.setAttribute('target', '_blank');
    twitter.appendChild(document.createElement('span'));
    twitter.querySelector('span').setAttribute('data-locale', 'APP_CONTACT_TWITTER');
    card.querySelector('div#' + card.id + '_CONTACT div.overlay-minicard-value div').appendChild(twitter);

    target.insertAdjacentElement('afterbegin', card);
}

/* 
 *  <div class="header-container">
 *    <div class="header-logo">
 *      <a href="#internal-link"><img src="./image/url/logo-icon.png"></a>
 *    </div>
 *  </div>
 */ 
function addLogo(target, link, url){
    jslogger.logger().trace('addLogo() was called.');

    let logo = document.createElement('div');
    logo.classList.add('header-logo');
    logo.appendChild(document.createElement('a'));
    logo.querySelector('div.header-logo a').href = link;
    logo.querySelector('div.header-logo a').appendChild(document.createElement('img'));
    logo.querySelector('div.header-logo a img').src = url;
    target.insertAdjacentElement('afterbegin', logo);
}

/* 
 *  <div class="header-container">
 *    <div class="header-logo">...</div>
 *    <div class="header-title">
 *      <span data-locale="NAME"></span>
 *    </div>
 *  </div>
 */ 
function addTitle(target, name){
    jslogger.logger().trace('addTitle() was called.');

    let title = document.createElement('div');
    title.classList.add('header-title');
    title.appendChild(document.createElement('span'));
    title.querySelector('span').setAttribute("data-locale", name);
    target.insertAdjacentElement('beforeend', title);
}

/* 
 *  <div class="header-container">
 *    <div class="header-logo">...</div>
 *    <div class="header-title">...</div>
 *    <div class="header-icon-container">
 *      <div class="header-icon icon-type1" id="HEADER_ICON_NAME1">
 *        <button id="ICON_NAME1">
 *      </div>
 *      <div class="header-icon icon-type2" id="HEADER_ICON_NAME2">
 *        <button id="ICON_NAME2">
 *      </div>
 *      ...
 *    </div>
 *  </div>
 */ 
function addActionIcon(target, type, name){
    jslogger.logger().trace('addActionIcon() was called.');

    if(!target.querySelector('div.header-icon-container')){
        let iconcontainer = document.createElement('div');
        iconcontainer.classList.add('header-icon-container');
        iconcontainer.classList.add('right-aligned');
        target.insertAdjacentElement('beforeend', iconcontainer);
    }

    let icon = document.createElement('div');
    icon.classList.add('header-icon');
    icon.id = 'HEADER_ICON_' + name;
    icon.appendChild(document.createElement('button'));
    icon.querySelector('div.header-icon#' + 'HEADER_ICON_' + name + ' button').classList.add('icon-button');
    icon.querySelector('div.header-icon#' + 'HEADER_ICON_' + name + ' button').classList.add(type);
    icon.querySelector('div.header-icon#' + 'HEADER_ICON_' + name + ' button').id = 'ICON_' + name;
    target.querySelector('div.header-icon-container').insertAdjacentElement('beforeend', icon);
}

/* 
 *  <div class="header-icon icon-type1" id="HEADER_ICON_ICONNAME">
 *    <button id="ICON_ICONNAME">
 *    <div class="header-icon-popup" id="HEADER_ICON_POPUP_ICONNAME">
 *      <div class="header-icon-popup-item" id="HEADER_ICON_POPUP_ICONNAME_NAME1">
 *        <span data-locale="NAME1"></span>
 *      </div>
 *      <div class="header-icon-popup-item" id="HEADER_ICON_POPUP_ICONNAME_NAME2">
 *        <span data-locale="NAME2"></span>
 *      </div>
 *      ...
 *    </div>
 *  </div>
 */ 
function addItemToActionIconPopup(target, name, type){
    jslogger.logger().trace('addItemToActionIconPopup() was called.');

    let iconname = target.id.replace(/^HEADER_ICON_/, '');
    if(!target.querySelector('div.header-icon-popup')){
        let popup = document.createElement('div');
        popup.classList.add('header-icon-popup');
        popup.id = 'HEADER_ICON_POPUP_' + iconname;
        target.insertAdjacentElement('beforeend', popup);
    };

    if(type == 'hr'){
        let hr = document.createElement('hr');
        hr.classList.add('menu-hr');
        target.querySelector('div.header-icon-popup').insertAdjacentElement('beforeend', hr);    
    }else{
        let menuitem = document.createElement('div');
        menuitem.classList.add('header-icon-popup-item');
        menuitem.id = 'HEADER_ICON_POPUP_' + iconname + '_' + name;
        menuitem.appendChild(document.createElement('span'));
        menuitem.querySelector('span').setAttribute("data-locale", 'POPUPMENU_' + name);
        if(type != ''){
            menuitem.appendChild(document.createElement('div'));
            menuitem.querySelector('div').classList.add('header-icon-popup-inlineicon');
            menuitem.querySelector('div').classList.add(type);
        };

        target.querySelector('div.header-icon-popup').insertAdjacentElement('beforeend', menuitem);    
    };
}

/* 
 *  <div class="option-container">
 *    <div class="option" id="OPTION_OPTNAME1">
 *      <div class="option-title">
 *        <span data-locale="CATEGORY_NAME"></span>
 *      </div>
 *    </div>
 *    ...
 *  </div>
 */ 
function appendOption(target, category){
    jslogger.logger().trace('appendOption() was called.');

    let option = document.createElement('div');
    option.classList.add('option');
    option.id = 'OPTION_' + category;

    let title = document.createElement('div');
    title.classList.add('option-title');
    title.appendChild(document.createElement('span'));
    title.querySelector('span').setAttribute('data-locale', 'CATEGORY_' + category.replace(/_[^_]*$/, ''));

    option.appendChild(title);
    target.appendChild(option);
}

/* 
 *  <div class="option" id="OPTION_OPTNAME1">
 *    <div class="option-item-container" id="GROUP_NAME1">
 *      <div class="option-item" id="NAME1">
 *         <div class="item-title" data-locale="TITLE_NAME1"></div>
 *      </div>
 *    </div>
 *    <div class="option-item-container" id="GROUP_NAME2">...</div>
 *    ...
 *  </div>
 */ 
function appendOptionItem(target, category, name, type, attribute){
    jslogger.logger().trace('appendOptionItem() was called.');

    if(type == 'hr'){
        let hr = document.createElement('hr');
        hr.classList.add('menu-hr');
        target.insertAdjacentElement('beforeend', hr);    
    }else{
        let group = document.createElement('div');
        group.classList.add('option-item-container');
        group.id = 'OPTIONGROUP_' + category + '_' + name;
    
        let optitem = document.createElement('div');
        optitem.classList.add('option-item');
        optitem.id = 'OPTIONITEM_' + category + '_' + name;
    
        let title = document.createElement('div');
        title.classList.add('item-title');
        title.setAttribute('data-locale', 'TITLE_' + category + '_' + name);
    
        optitem.appendChild(title);
        group.appendChild(optitem);
        target.querySelector('div.option#OPTION_' + category).appendChild(group);
    
        if(type == 'ITEMSW'){
            implementItemswitch(target, category, name, attribute);    
        }else{
            implementToggleswitch(target, category, name, attribute);    
        };
    };
}

/*
 *  // attribute = 'default'
 *  <div class="option-item-container" id="GROUP_NAME1">
 *    <div class="option-item" id="NAME1">
 *      <div class="item-title" data-locale="TITLE_NAME1"></div>
 *      <div class="toggleswitch right-aligned">
 *        <input type="checkbox" id="CONFIG_NAME1" class="switch">
 *        <label htmlFor="CONFIG_NAME1" class="toggle"></label>
 *      </div>
 *    </div>
 *  </div>
 *  // attribute = 'reverse'
 *  <div class="option-item-container" id="GROUP_NAME2">
 *    <div class="option-item" id="NAME2">
 *      <div class="toggleswitch">
 *        <input type="checkbox" id="CONFIG_NAME2" class="switch">
 *        <label htmlFor="CONFIG_NAME2" class="toggle"></label>
 *      </div>
 *      <div class="item-title" data-locale="TITLE_NAME2"></div>
 *    </div>
 *  </div>
 *  // attribute = 'stretch'
 *  <div class="option-item-container" id="GROUP_NAME3">
 *    <div class="option-item" id="NAME3">
 *      <div class="toggleswitch">
 *        <input type="checkbox" id="CONFIG_NAME3" class="switch">
 *        <label htmlFor="CONFIG_NAME3" class="toggle"></label>
 *      </div>
 *      <div class="item-title right-aligned" data-locale="TITLE_NAME1"></div>
 *    </div>
 *  </div>
 */
function implementToggleswitch(target, category, name, attribute){
    jslogger.logger().trace('implementToggleswitch() was called.');

    let toggleswitch = document.createElement('div');
    toggleswitch.classList.add('toggleswitch');
    toggleswitch.appendChild(document.createElement('input'))
    toggleswitch.querySelector('input').type = 'checkbox';
    toggleswitch.querySelector('input').id = 'CONFIG_' + category + '_' + name;
    toggleswitch.querySelector('input').classList.add('switch');
    toggleswitch.appendChild(document.createElement('label'))
    toggleswitch.querySelector('label').htmlFor = 'CONFIG_' + category + '_' + name;
    toggleswitch.querySelector('label').classList.add('toggle');

    if(attribute == 'reverse' && target.querySelector('div.option-item#OPTIONITEM_' + category + '_' + name)){
        target.querySelector('div.option-item#OPTIONITEM_' + category + '_' + name).insertAdjacentElement('afterbegin', toggleswitch);
    }else if(attribute == 'stretch' && target.querySelector('div.option-item#OPTIONITEM_' + category + '_' + name)){
        target.querySelector('div.option-item#OPTIONITEM_' + category + '_' + name).insertAdjacentElement('afterbegin', toggleswitch);
        target.querySelector('div.option-item#OPTIONITEM_' + category + '_' + name + ' div.item-title').classList.add('right-aligned');
    }else if(target.querySelector('div.option-item#OPTIONITEM_' + category + '_' + name)){
        toggleswitch.classList.add('right-aligned');
        target.querySelector('div.option-item#OPTIONITEM_' + category + '_' + name).insertAdjacentElement('beforeend', toggleswitch);
    };
}

/*
 *  // style = 'default'
 *  <div class="option-item-container" id="GROUP_NAME1">
 *    <button class="item-switch"></button>
 *    <div class="option-item" id="NAME1">
 *      <div class="item-title" data-locale="TITLE_NAME1"></div>
 *      <div class="toggleswitch right-aligned unclickable">
 *        <input type="checkbox" id="CONFIG_NAME1" class="switch">
 *        <label htmlFor="CONFIG_NAME1" class="toggle"></label>
 *      </div>
 *    </div>
 *  </div>
 *  // style = 'reverse'
 *  <div class="option-item-container" id="GROUP_NAME2">
 *    <button class="item-switch"></button>
 *    <div class="option-item" id="NAME2">
 *      <div class="toggleswitch unclickable">
 *        <input type="checkbox" id="CONFIG_NAME2" class="switch">
 *        <label htmlFor="CONFIG_NAME2" class="toggle"></label>
 *      </div>
 *      <div class="item-title" data-locale="TITLE_NAME2"></div>
 *    </div>
 *  </div>
 *  // style = 'stretch'
 *  <div class="option-item-container" id="GROUP_NAME3">
 *    <button class="item-switch"></button>
 *    <div class="option-item" id="NAME3">
 *      <div class="toggleswitch unclickable">
 *        <input type="checkbox" id="CONFIG_NAME3" class="switch">
 *        <label htmlFor="CONFIG_NAME3" class="toggle"></label>
 *      </div>
 *      <div class="item-title right-aligned" data-locale="TITLE_NAME3"></div>
 *    </div>
 *  </div>
 */
function implementItemswitch(target, category, name, attribute){
    jslogger.logger().trace('implementToggleswitch() was called.');

    let toggleswitch = document.createElement('div');
    toggleswitch.classList.add('toggleswitch');
    toggleswitch.classList.add('unclickable');
    toggleswitch.appendChild(document.createElement('input'))
    toggleswitch.querySelector('input').type = 'checkbox';
    toggleswitch.querySelector('input').id = 'CONFIG_' + category + '_' + name;
    toggleswitch.querySelector('input').classList.add('switch');
    toggleswitch.appendChild(document.createElement('label'))
    toggleswitch.querySelector('label').htmlFor = 'CONFIG_' + category + '_' + name;
    toggleswitch.querySelector('label').classList.add('toggle');

    let itemswitch = document.createElement('button');
    itemswitch.classList.add('item-switch');

    if(attribute == 'reverse' && target.querySelector('div.option-item#OPTIONITEM_' + category + '_' + name)){
        target.querySelector('div.option-item#OPTIONITEM_' + category + '_' + name).insertAdjacentElement('afterbegin', toggleswitch);
        target.querySelector('div.option-item#OPTIONITEM_' + category + '_' + name).insertAdjacentElement('beforebegin', itemswitch);
    }else if(attribute == 'stretch' && target.querySelector('div.option-item#OPTIONITEM_' + category + '_' + name)){
        target.querySelector('div.option-item#OPTIONITEM_' + category + '_' + name).insertAdjacentElement('afterbegin', toggleswitch);
        target.querySelector('div.option-item#OPTIONITEM_' + category + '_' + name + ' div.item-title').classList.add('right-aligned');
        target.querySelector('div.option-item#OPTIONITEM_' + category + '_' + name).insertAdjacentElement('beforebegin', itemswitch);
    }else if(target.querySelector('div.option-item#OPTIONITEM_' + category + '_' + name)){
        toggleswitch.classList.add('right-aligned');
        target.querySelector('div.option-item#OPTIONITEM_' + category + '_' + name).insertAdjacentElement('beforeend', toggleswitch);
        target.querySelector('div.option-item#OPTIONITEM_' + category + '_' + name).insertAdjacentElement('beforebegin', itemswitch);
    };
}

function registerEventListenerOnOverlayScreen(){
    jslogger.logger().trace('registerEventListenerOnOverlayScreen() was called.');

    document.querySelector('div.overlay').addEventListener('click', (event) => {
        if(event.target.classList.contains('overlay') 
            || event.target.classList.contains('overlay-minicard-close') || event.target.classList.contains('overlay-minicard-close-symbol')){
            jslogger.logger().debug('Overlay screen area was clicked.');

            document.querySelector('div.overlay').classList.remove('active');
            document.querySelectorAll('div.overlay div.overlay-minicard').forEach((card) => {
                card.classList.add('hidden');
                card.classList.remove('active');
            });
        }else{
            jslogger.logger().debug('Overlay screen area was clicked.');
        };
    });

    document.querySelector('html body').addEventListener('click', (event) => {
        if(!event.target.closest('div.header-icon-popup.active#HEADER_ICON_POPUP_HAMBURGER') 
            && !event.target.closest('div.header-icon#HEADER_ICON_HAMBURGER')){
            jslogger.logger().trace('The outside area of Popup menu was clicked.');

            document.querySelectorAll('div.header-icon-container div.header-icon-popup').forEach((popup) => {
                popup.classList.remove('active');
            });
        };
    });
}

function registerEventListenerOnMenuButtons(){
    jslogger.logger().trace('registerEventListenerOnMenuButtons() was called.');

    // Icon button
    document.querySelectorAll('div.header-icon-container button.icon-button').forEach((icon) => {
        if(icon.id == 'ICON_HAMBURGER'){
            icon.addEventListener('click', () => {
                jslogger.logger().debug('Icon button#' + icon.id + ' was clicked.');

                icon.parentElement.querySelector('div.header-icon-popup').classList.toggle('active');
            });
        };
    });

    // Hamburger menu item
    document.querySelectorAll('div.header-icon-container div.header-icon-popup#HEADER_ICON_POPUP_HAMBURGER div.header-icon-popup-item').forEach((menu) => {
        if(menu.id == 'HEADER_ICON_POPUP_HAMBURGER_RESET'){
            menu.addEventListener('click', () => {
                jslogger.logger().debug('Popup menu item#' + menu.id + ' was clicked.');

                // Initialize all configs.
                document.querySelectorAll('div.toggleswitch input[type=checkbox]').forEach(async (togglesw) => {
                    if(togglesw.id == 'CONFIG_UI_ADD_1000' || togglesw.id == 'CONFIG_UI_ADD_1DAY' || togglesw.id == 'CONFIG_UI_ADD_ALL'
                    || togglesw.id == 'CONFIG_UI_ADD_NEXT20' || togglesw.id == 'CONFIG_UI_ADD_NEXT100' 
                    || togglesw.id == 'CONFIG_AUTOMATION_ENABLE_AUTOFEEDBACK' || togglesw.id == 'CONFIG_LOGGING_ENABLE_LOGGING'){
                        await clstorage.storeConfig(togglesw.id, true);
                    }else{
                        await clstorage.storeConfig(togglesw.id, false);
                    };
                });
                reflectConfigs();

                document.querySelectorAll('div.header-icon-container div.header-icon-popup').forEach((popup) => {
                    popup.classList.remove('active');
                });
            });
        }else if(menu.id == 'HEADER_ICON_POPUP_HAMBURGER_CLEAR'){
            menu.addEventListener('click', async () => {
                jslogger.logger().debug('Popup menu item#' + menu.id + ' was clicked.');

                // Clear all configs.
                await clstorage.clearConfigs();
                reflectConfigs();

                document.querySelectorAll('div.header-icon-container div.header-icon-popup').forEach((popup) => {
                    popup.classList.remove('active');
                });
            });
        }else if(menu.id == 'HEADER_ICON_POPUP_HAMBURGER_REPORT'){
            menu.addEventListener('click', () => {
                jslogger.logger().debug('Popup menu item#' + menu.id + ' was clicked.');

                window.open(chrome.i18n.getMessage('APP_CONTACT_REPORT_URL'));
                jslogger.logger().info('Newly open the feedback page.');
                // Need to be replaced
                //window.open(chrome.runtime.getURL('options.html') + '?menu=SITE&submenu=YOUTUBELIVE');
                //logger.info('Open the extension options page with the query parameter. (options.html was newly opened)');

                document.querySelectorAll('div.header-icon-container div.header-icon-popup').forEach((popup) => {
                    popup.classList.remove('active');
                });
            });
        }else if(menu.id == 'HEADER_ICON_POPUP_HAMBURGER_ABOUT'){
            menu.addEventListener('click', () => {
                jslogger.logger().debug('Popup menu item#' + menu.id + ' was clicked.');

                document.querySelector('div.overlay').classList.add('active');
                document.querySelector('div.overlay div.overlay-minicard#OVERLAY_CARD_ABOUT').classList.add('active');
                document.querySelector('div.overlay div.overlay-minicard#OVERLAY_CARD_ABOUT').classList.remove('hidden');
                document.querySelectorAll('div.overlay div.overlay-minicard:not(#OVERLAY_CARD_ABOUT)').forEach((card) => {
                    card.classList.add('hidden');
                    card.classList.remove('active');
                });

                document.querySelectorAll('div.header-icon-container div.header-icon-popup').forEach((popup) => {
                    popup.classList.remove('active');
                });
            });
        };
    });
}

function registerEventListenerOnToggleSwitches(){
    jslogger.logger().trace('registerEventListenerOnToggleSwitches() was called.');

    // Simulate a click event on the toggle switch when the clickable item was clicked.
    document.querySelectorAll('div.option div.option-item-container button.item-switch').forEach((itemsw) => {
        itemsw.addEventListener('click', () => {
            jslogger.logger().debug('Clickable area of togglesw#' + itemsw.parentElement.querySelector('div.toggleswitch input[type=checkbox]').id + ' was clicked.');

            itemsw.parentElement.querySelector('div.toggleswitch input[type=checkbox]').click();
            jslogger.logger().debug('Simulated a click event on togglesw#' + itemsw.parentElement.querySelector('div.toggleswitch input[type=checkbox]').id + ' since Clickable area was clicked.');
        });
    });

    // Listen 'change' event to handle a click event on the toggle switch.
    document.querySelectorAll('div.option div.toggleswitch input[type=checkbox]').forEach((togglesw) => {
        togglesw.addEventListener('change', async () => {
            jslogger.logger().debug('togglesw#' + togglesw.id + ' was clicked.');

            await clstorage.storeConfig(togglesw.id, togglesw.checked);

            jslogger.logger().info('Configuration was changed. Please reload tabs.');
        });
    });
}
