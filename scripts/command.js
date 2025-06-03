/**
 * @ Licence: OwnPlot, the OwnTech data plotter. Copyright (C) 2022. Matthias Riffard & Guillaume Arthaud - OwnTech Foundation.
	Delivered under GNU Lesser General Public License Version 2.1 (https://opensource.org/licenses/LGPL-2.1)
 * @ Website: https://www.owntech.org/
 * @ Mail: owntech@laas.fr
 * @ Create Time: 2022-08-30 09:31:24
 * @ Modified by: Jean Alinei
 * @ Modified time: 2022-09-07 14:01:55
 * @ Description:
 */

const sendInput   = $("#sendInput");
const sendBtn     = $("#sendBtn");
const addCommandBtn   = $("#addCommandBtn");
const addCommandName  = $("#addCommandName");
const addCommandData  = $("#addCommandData");
const addCommandColor = $("#addCommandColor");
const deleteButtonButton = $("#deleteButtonButton");
const terminalHistory    = $("#terminalHistory");
const MAX_TERMINAL_LINES = 1000;

const encoder = new TextEncoder();

let commandButtons = [];
let deleteMode = false;
let commandBtnTimestamp = $('#commandBtnTimestamp');
let autoSendBtn       = $('#autoSendBtn');
let autoSendPeriod    = $('#autoSendPeriod');
let autoSendValue     = 1000;
let autoSendIntervalId = null;
let lastLoadedButtons = [];

$(() => {
    disableSend();
    updateCommandButtons();

    $(document).on("configSelected", function(event, selectedConfigName) {
        if (selectedConfigName && selectedConfigName !== "new") {
            loadButtonsFromConfig(selectedConfigName);
        }
    });

    autoSendPeriod.on("input", function() {
        if (autoSendPeriod.val().length > 1) {
            autoSendValue = parseInt(autoSendPeriod.val());
        }
    });

    enterKeyupHandler(sendInput, () => {
        send(sendInput.val());
    });

    sendBtn.on('click', () => {
        if (autoSendBtn.attr('aria-pressed') === "true") {
            if (autoSendIntervalId) {
                clearInterval(autoSendIntervalId);
                autoSendIntervalId = null;
            }
            autoSendIntervalId = setInterval(() => {
                handleSend();
            }, autoSendValue);
        } else {
            handleSend();
        }
    });

    enterKeyupHandler(addCommandName, addCommandSubmitHandler);
    enterKeyupHandler(addCommandData, addCommandSubmitHandler);
    addCommandBtn.on('click', addCommandSubmitHandler);

    deleteButtonButton.on('click', function() {
        if (deleteMode) {
            deleteMode = false;
            deleteButtonButton.html("Delete buttons");
        } else {
            deleteMode = true;
            deleteButtonButton.html("Stop deleting buttons");
        }
        updateCommandButtons();
    });

    $("#clearHistoryButton").on("click", function() {
        $("#terminalHistory").empty();
    });

    commandTimestampBtnEnable(commandBtnTimestamp);
    commandBtnTimestamp.on('click', function() {
        if (commandBtnTimestamp.attr('aria-pressed') === "true") {
            commandTimestampBtnDisable(commandBtnTimestamp);
        } else {
            commandTimestampBtnEnable(commandBtnTimestamp);
        }
    });

    autoSendBtnDisable(autoSendBtn);
    autoSendBtn.on('click', function() {
        if (autoSendBtn.attr('aria-pressed') === "true") {
            clearInterval(autoSendIntervalId);
            autoSendBtnDisable(autoSendBtn);
        } else {
            autoSendBtnEnable(autoSendBtn);
        }
    });
});

function addCommandSubmitHandler() {
    let button = {
        text: addCommandName.val(),
        command: addCommandData.val(),
        defaultColor: true,
        isClear: false
    };
    if (button.text === "") {
        addCommandName[0].select();
    } else if (button.command === "") {
        addCommandData[0].select();
    } else {
        addCommandButton(button);
    }
}

function addCommandButton(newButton) {
    newButton.icon = "fa-solid fa-paper-plane";
    commandButtons.push(newButton);
    updateCommandButtons();
}

async function loadButtonsFromConfig(configFileName) {
    try {
        const config = await ipcRenderer.invoke('config-load', configFileName);
        commandButtons = config.buttons || [];

        lastLoadedButtons = JSON.parse(JSON.stringify(commandButtons)); // deep clone
        updateCommandButtons();
    } catch (err) {
        console.error("Failed to load config:", err);
    }
}
const compareArrays = (a, b) =>
    a.length === b.length &&
    a.every((element, index) => element === b[index]);

function updateCommandButtons() {
    if (commandButtons.length > 0) {
        deleteButtonButton.show();
    } else {
        deleteButtonButton.hide();
        deleteMode = false;
    }

    if (!compareArrays(commandButtons, lastLoadedButtons)) {
        saveConfigButtonButton.show();
    } else {
        saveConfigButtonButton.hide();
    }

    if (commandButtons.length) {
        $("#commandButtonContainer").empty();
        commandButtons.forEach((elem, index) => {
            let iconHtml = "";
            if (elem.icon != "undefined") {
                iconHtml = '<i class="' + elem.icon + '"></i>&nbsp;';
            }
            let buttonHtml = '<div class="mb-2">';
            buttonHtml += '<div class="input-group">';
            if(elem.defaultColor){
                buttonHtml += '<button type="button" class="btn btn-primary form-control commandButton" id="cmdBtn-' + index + '">' + iconHtml + elem.text + '</button>';
            } else {
                if(elem.isClear){
                    buttonHtml += '<button type="button" class="btn btn-primary form-control commandButton" id="cmdBtn-' + index + '" style="background-color:' + elem.color + '; border-color:'+ elem.color +'; color:#000">' + iconHtml + elem.text + '</button>';
                } else {
                    buttonHtml += '<button type="button" class="btn btn-primary form-control commandButton" id="cmdBtn-' + index + '" style="background-color:' + elem.color + '; border-color:'+ elem.color +';">' + iconHtml + elem.text + '</button>';
                }
            }
            if (deleteMode == true) {
                buttonHtml += '<button type="button" class="btn btn-danger removeCommandButton" id="rmvBtn' + index + '"><i class="fa-solid fa-trash-can deleteAnnim"></i></button>';
            }
            buttonHtml += '</div>';
            buttonHtml += '</div>';
            $("#commandButtonContainer").append(buttonHtml);
            $('#cmdBtn-' + index).on('click', function() { //check if port is opened
                handleCommandButtonClick(elem);
                send(elem.command);
                appendToTerminal(elem.command + " (" + elem.text + ")");
            });
        });
        $(".removeCommandButton").on("click", function() {
            let buttonIndex = getIntInString($(this).attr("id"));
            commandButtons.splice(buttonIndex, 1);
            updateCommandButtons();
        });
        $("#commandButtonContainer").show();
    } else {
        $("#commandButtonContainer").hide();
    }

    if (portIsOpen) {
        enableSend();
    } else {
        disableSend();
    }
}

async function send(stringToSend) {
    await port.write(encoder.encode(stringToSend), (err) => {
        // if (err) {
        //     printDebugTerminal(err);
        // } not available in this version
    });
}

function enableSend() {
    sendInput.prop("disabled", false);
    sendBtn.prop("disabled", false);
    $(".commandButton").prop("disabled", false);
}

function disableSend() {
    sendInput.prop("disabled", true);
    sendBtn.prop("disabled", true);
    $(".commandButton").prop("disabled", true);
}

function appendToTerminal(command) {
    const commandElement = $("<span></span>").text(command);
    const timestampElement = $("<span></span>").text(commandTime());
    const lineElement = $("<div></div>").append(timestampElement, commandElement);
    terminalHistory.prepend(lineElement);

    // Remove the oldest lines if the number of lines exceeds the limit
    const commandElements = terminalHistory.children();
    if (commandElements.length > MAX_TERMINAL_LINES) {
        commandElements.slice(MAX_TERMINAL_LINES).remove();
    }
}

function commandTimestampBtnEnable(elem) {
	elem.attr('aria-pressed', 'true');
	elem.removeClass('btn-warning');
	elem.addClass('btn-success');
}

function commandTimestampBtnDisable(elem) {
	elem.attr('aria-pressed', 'false');
	elem.removeClass('btn-success');
	elem.addClass('btn-warning');
}

function commandTime() {
	let timeStr = "";
	if (commandBtnTimestamp.attr('aria-pressed') === "true") {
		let dataTime = new Date(); //we get the time of the last data received
		if(absTimeMode){
			timeStr = dateToPreciseTimeString(dataTime);
		} else { //relative time
			timeStr = millisecondsElapsed(chartStartTime, dataTime);
		}
		timeStr+= " -> ";
	}
	return(timeStr);
}

function autoSendBtnEnable(elem) {
	elem.attr('aria-pressed', 'true');
	elem.removeClass('btn-warning');
	elem.addClass('btn-success');
}

function autoSendBtnDisable(elem) {
	elem.attr('aria-pressed', 'false');
	elem.removeClass('btn-success');
	elem.addClass('btn-warning');
}

function handleCommandButtonClick(commandConfig) {
    if (autoSendBtn.attr('aria-pressed') === "true") {
        if (autoSendIntervalId) {
            clearInterval(autoSendIntervalId);
            autoSendIntervalId = null;
        }
        autoSendIntervalId = setInterval(() => {
            send(commandConfig.command);
            appendToTerminal(commandConfig.command + " (" + commandConfig.text + ")");
        }, autoSendValue);
    }
}

function handleSend() {
    const commandConfig = commandButtons.find(button => button.command === sendInput.val());
    if(commandConfig){
        send(sendInput.val());
        appendToTerminal(sendInput.val() + " (" + commandConfig.text + ")");
    }else{
        appendToTerminal(sendInput.val() + " (" + 'unknown command' + ")");
    }
}