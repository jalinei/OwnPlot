/**
 * @ Licence: OwnPlot, the OwnTech data plotter. Copyright (C) 2025 Jean Alinei OwnTech Foundation.
	Delivered under GNU Lesser General Public License Version 2.1 (https://opensource.org/licenses/LGPL-2.1)
 * @ Website: https://www.owntech.org/
 * @ Mail: owntech@laas.fr
 * @ Create Time: 2022-08-30 09:31:24
 * @ Modified by: Jean Alinei
 * @ Modified time: 2022-09-07 14:01:55
 * @ Description: Renderer for the config manager
 */


const { ipcRenderer } = require("electron");

const saveConfigInputGroup = $("#saveConfigInputGroup");
const saveConfigButton = $("#saveConfigButton");
const saveConfigName = $("#saveConfigName");
const saveConfigButtonButton = $("#saveConfigButtonButton");
const buttonConfigSelect = $("#buttonConfigSelect");
const deleteConfigButton = $("#deleteConfigButton");

let configButtonPath = "";

$(() => {
    init();
});

async function init() {
    try {
        const userDataFolder = await ipcRenderer.invoke('get-user-data-folder');
        configButtonPath = userDataFolder + "/config/buttons";

        saveConfigButton.on('click', () => {
            if (saveConfigName.val().length > 0) {
                const filename = addJsonOrNot(saveConfigName.val());
                ipcRenderer.invoke('config-save-buttons', { filename, commandButtons })
                    .then(handleSaveCallback)
                    .catch((err) => console.log(`Error saving config: ${err}`));
            }
        });

        saveConfigButtonButton.on('click', () => {
            const selected = $("#buttonConfigSelect option:selected").val();
            const filename = selected === "new" ? addJsonOrNot(saveConfigName.val()) : selected;
            ipcRenderer.invoke('config-save-buttons', { filename, commandButtons })
                .then(handleSaveCallback)
                .catch((err) => console.log(`Error saving config: ${err}`));
        });

        buttonConfigSelect.change(updateNewFieldVisibility);
        deleteConfigButton.on('click', handleDeleteConfig);

        updateCommandFilesList("new");

    } catch (err) {
        console.error("Failed to get user data folder:", err);
    }
}

function addJsonOrNot(filename) {
    const extension = filename.slice(-5).toLowerCase();
    return extension === ".json" ? filename : `${filename}.json`;
}

function handleSaveCallback() {
    console.log("Saved successfully");
    updateCommandFilesList("new");
}

function updateCommandFilesList(selectedItem) {
    let configSelectHtml = `<option ${selectedItem === "new" ? "selected" : ""} value="new">-- new --</option>`;

    ipcRenderer.invoke('config-list-files')
        .then((files) => {
            filesConfigButton = files;
            files.forEach((file) => {
                const selected = selectedItem === file ? "selected" : "";
                configSelectHtml += `<option ${selected} value="${file}">${file}</option>`;
            });

            buttonConfigSelect.html(configSelectHtml);

            if (selectedItem) buttonConfigSelect.val(selectedItem);

            updateNewFieldVisibility();
        })
        .catch((err) => {
            console.log("Failed to load config files:", err);
        });
}

function updateNewFieldVisibility() {
    const selected = $("#buttonConfigSelect option:selected").val();
    if (selected === "new") {
        commandButtons = [];
        saveConfigInputGroup.show();
        deleteConfigButton.prop("disabled", true).addClass("disabled");
    } else {
        saveConfigInputGroup.hide();
        deleteConfigButton.prop("disabled", false).removeClass("disabled");
        $(document).trigger("configSelected", [selected]);
    }
}

function handleDeleteConfig() {
    const selectedConfig = $("#buttonConfigSelect option:selected").val();
    const modalEl = document.getElementById('deleteConfigModal');
    const modalInstance = new bootstrap.Modal(modalEl);

    $('#deleteConfigModal .config-name').text('Selected configuration : ' + selectedConfig);
    modalInstance.show();

    const confirmBtn = document.getElementById('confirmDeleteConfigButton');
    const cancelBtn = document.getElementById('cancelDeleteConfigButton');

    const handleConfirm = () => {
        if (selectedConfig !== "new") {
            ipcRenderer.invoke('config-delete', selectedConfig)
                .then(() => {
                    console.log(`Deleted ${selectedConfig}`);
                    updateCommandFilesList("new");
                    buttonConfigSelect.val("new");
                })
                .catch((err) => {
                    console.log(`Error deleting file: ${err}`);
                });
        }
        modalInstance.hide();
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
    };

    const handleCancel = () => {
        modalInstance.hide();
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
    };

    confirmBtn.addEventListener('click', handleConfirm, { once: true });
    cancelBtn.addEventListener('click', handleCancel, { once: true });
}