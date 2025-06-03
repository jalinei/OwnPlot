/**
 * @ Licence: OwnPlot, the OwnTech data plotter. Copyright (C) 2025 Jean Alinei OwnTech Foundation.
	Delivered under GNU Lesser General Public License Version 2.1 (https://opensource.org/licenses/LGPL-2.1)
 * @ Website: https://www.owntech.org/
 * @ Mail: owntech@laas.fr
 * @ Create Time: 2022-08-30 09:31:24
 * @ Modified by: Jean Alinei
 * @ Modified time: 2022-09-07 14:01:55
 * @ Description: Node module for the config manager
 */


const fs = require('fs');
const path = require('path');

let configButtonPath = "";

function setConfigPath(path) {
    configButtonPath = path;
}

function getConfigFilePath(fileName) {
    return path.join(configButtonPath, fileName);
}

function loadConfig(fileName) {
    const filePath = getConfigFilePath(fileName);
    if (!fs.existsSync(filePath)) return {};
    const rawData = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(rawData);
}

function saveConfig(fileName, configObject) {
    const filePath = getConfigFilePath(fileName);
    fs.writeFileSync(filePath, JSON.stringify(configObject, null, 2), 'utf-8');
}

function saveCommandButtons(filename, commandButtons, callback) {
    const data = JSON.stringify({ buttons: commandButtons }, null, 2);
    fs.writeFile(path.join(configButtonPath, filename), data, 'utf8', err => {
        callback?.(err);
    });
}

function deleteConfig(configName, callback) {
    const filePath = path.join(configButtonPath, configName);
    fs.unlink(filePath, callback);
}

function listConfigFiles(callback) {
    fs.readdir(configButtonPath, callback);
}

function applySerialSettings(serialConfig) {
    Object.assign(configSerialPlot, serialConfig);
    // manually trigger UI updates (e.g., baudRate field, format select, etc.)
    // OR: trigger a shared UI refresh function you already use on startup
  }

function applyPlotStyle(plotStyle) {
    if (!plotStyle || !plotStyle.datasets) return;
    myChart.data.datasets.forEach((ds, i) => {
      const saved = plotStyle.datasets[i];
      if (!saved) return;
      ds.label = saved.label;
      ds.backgroundColor = saved.backgroundColor;
      ds.borderColor = saved.backgroundColor; // consistent line color
      ds.lineStyleName = saved.lineStyleName;
      ds.lineBorderDash = lineStylesEnum[saved.lineStyleName];
      ds.pointStyleName = saved.pointStyleName;
      ds.pointStyle = pointStylesEnum[saved.pointStyleName];
      ds.pointRadius = saved.pointRadius;
      ds.lineBorderWidth = saved.lineBorderWidth;
      ds.yAxisID = saved.yAxisID;
      ds.hidden = configDS.visible === false;
    });
    updateLegendTable();
    myChart.update();
}

module.exports = {
    setConfigPath,
    loadConfig,
    saveConfig,
    saveCommandButtons,
    deleteConfig,
    listConfigFiles,
    getCommands: (config) => config.buttons || [],
    setCommands: (config, buttons) => { config.buttons = buttons; },
    getPlotSettings: (config) => config.plot || { datasets: [] },
    setPlotSettings: (config, plot) => { config.plot = plot; },
    getPortSettings: (config) => config.port || {},
    setPortSettings: (config, port) => { config.port = port; }
};