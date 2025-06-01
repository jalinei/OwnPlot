const $ = require('jquery');

$(document).ready(function () {
  let selectedFilePath = null;
  let flashing = false;

  ipcRenderer.invoke('get-example-bins').then((bins) => {
    const $select = $('#exampleSelect');
    bins.forEach(({ name, fullPath }) => {
      // <option value="fullPath">name</option>
      $select.append(`<option value="${fullPath}">${name}</option>`);
    });
  });

  // When the user picks an example, set selectedFilePath to its path
  $('#exampleSelect').on('change', function () {
    const chosenPath = $(this).val();
    if (chosenPath) {
      selectedFilePath = chosenPath;
      $('#flashLogOutput').val(`Loaded example: ${chosenPath.split(/[\\/]/).pop()}\n`);
      // Clear the file‐input so the user knows the .bin is selected from examples
      $('#firmwareFileInput').val('');
    }
  });

  // Handle file‐input selection (overrides example choice)
  $('#firmwareFileInput').on('change', (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      selectedFilePath = files[0].path;
      $('#flashLogOutput').val(`Selected file: ${files[0].name}\n`);
      // Reset example dropdown back to default
      $('#exampleSelect').prop('selectedIndex', 0);
    }
  });

  // Handle Flash Firmware button click
  $('#startFlashButton').on('click', () => {
    const port = $('#AvailablePorts').val();
    if (!selectedFilePath || !port) {
      $('#flashLogOutput')
        .val('Please select both firmware file and port.\n')
        .addClass('text-danger');
      return;
    }

    // UI setup for flashing
    $('#flashLogOutput').removeClass('text-danger text-success').val('Flashing started...\n');
    $('#flashProgressWrapper').removeClass('d-none');
    $('#flashProgressBar')
      .css('width', '0%')
      .attr('aria-valuenow', 0)
      .text('0%')
      .removeClass('bg-danger bg-success');

    // Hide Flash, show Cancel
    $('#startFlashButton').addClass('d-none');
    $('#cancelFlashButton').removeClass('d-none');

    flashing = true;
    ipcRenderer.invoke('start-flash', {
      comPort: port,
      firmwarePath: selectedFilePath
    });
  });

  // endFlashingUI: restores buttons once flash completes
  function endFlashingUI() {
    flashing = false;
    $('#startFlashButton').removeClass('d-none');
    $('#cancelFlashButton').addClass('d-none');
  }

  // Handle Cancel button click: only send cancel, UI will update on "flash-complete"
  $('#cancelFlashButton').on('click', () => {
    ipcRenderer.send('cancel-flash');
    $('#flashLogOutput').val($('#flashLogOutput').val() + 'Flash cancelled by user.\n');
  });

  // Toggle Flash Log visibility
  $('#toggleFlashLog').on('change', function () {
    $('#flashLogWrapper').toggleClass('d-none', !this.checked);
  });

  // Listen for flash-progress updates (just update log + progress bar)
  ipcRenderer.on('flash-progress', (_event, message) => {
    const $log = $('#flashLogOutput');
    const $bar = $('#flashProgressBar');

    // Append message to log
    $log.val($log.val() + message + '\n');
    $log.scrollTop($log[0].scrollHeight);

    // Extract percentage and speed
    const percentMatch = message.match(/(\d{1,3}(?:\.\d{1,2})?)%\s/);
    const speedMatch = message.match(/(\d+(?:\.\d+)?)\s*KiB\/s/);

    let progressText = '';
    if (percentMatch) {
      const progress = parseFloat(percentMatch[1]);
      $bar.css('width', `${progress}%`).attr('aria-valuenow', progress.toFixed(1));
      progressText += `${progress.toFixed(1)}%`;
    }
    if (speedMatch) {
      const speed = parseFloat(speedMatch[1]);
      progressText += `    ${speed.toFixed(2)} kB/s`;
    }
    if (progressText) {
      $bar.text(progressText);
    }
  });

  // Listen for the “flash-complete” event—only then reset UI
  ipcRenderer.on('flash-complete', () => {
    endFlashingUI();
  });
});
