// pH Controller Web Interface - Simplified Version
// Socket.io connection
const socket = io();

socket.on('connect', () => {
  console.log('Socket connected');
  updateConnectionStatus(true);
});

socket.on('disconnect', () => {
  console.log('Socket disconnected');
  updateConnectionStatus(false);
});

socket.on('ph_update', (data) => {
  console.log('📊 Real-time pH data received:', data);
  console.log('🔄 Attempting to add to chart...');
  
  // Update dashboard displays
  updatePhDisplay(data);
  
  // Update real-time chart
  addToRealtimeChart(data.ph);
  
  // Update servo display if needed
  if (data.servo_angle !== undefined) {
    updateServoDisplay({
      servo_angle: data.servo_angle,
      ph_calibrated: true,
      wifi_connected: true
    });
  }
});

socket.on('servo_status_update', (data) => {
  console.log('Servo status update:', data);
  updateServoDisplay(data);
});

// ===== CONNECTION STATUS =====
function updateConnectionStatus(connected) {
  const statusDot = document.getElementById('connection_status');
  const statusText = document.getElementById('connection_text');
  
  if (statusDot) {
    statusDot.className = connected ? 'status-dot connected' : 'status-dot disconnected';
  }
  if (statusText) {
    statusText.textContent = connected ? 'Terhubung' : 'Terputus';
  }
}

// ===== PH MONITORING =====
let phRealtimeChart = null;
let chartPaused = false;
let chartMode = 'realtime'; // 'realtime' or 'historical'
let chartInitialized = false; // Flag to prevent multiple initialization
const maxChartPoints = 30;

function initializeRealtimeChart() {
  if (chartInitialized) {
    console.log('📊 Chart already initialized, skipping...');
    return;
  }
  
  console.log('🎨 Starting chart initialization...');
  
  // Check if Chart.js is available
  if (typeof Chart === 'undefined') {
    console.error('❌ Chart.js library not loaded!');
    setTimeout(initializeRealtimeChart, 1000); // Retry after 1 second
    return;
  }
  
  const chartCanvas = document.getElementById('ph_chart');
  if (!chartCanvas) {
    console.error('❌ Chart canvas element not found!');
    setTimeout(initializeRealtimeChart, 500); // Retry after 500ms
    return;
  }
  
  console.log('✅ Chart canvas found, Chart.js available, creating Chart...');

  // Destroy existing chart if any
  const existingChart = Chart.getChart(chartCanvas);
  if (existingChart) {
    console.log('🧹 Destroying existing chart...');
    existingChart.destroy();
  }
  
  // Also destroy our global chart if exists
  if (phRealtimeChart) {
    console.log('🧹 Destroying global chart...');
    phRealtimeChart.destroy();
    phRealtimeChart = null;
  }

  const ctx = chartCanvas.getContext('2d');
  
  try {
  phRealtimeChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'pH Level',
        data: [],
        borderColor: '#0066d6',
        backgroundColor: 'rgba(0, 102, 214, 0.15)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: '#0066d6'
      }, {
        label: 'pH 7 Target',
        data: [],
        borderColor: '#28a745',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        borderWidth: 1,
        fill: false,
        pointRadius: 0
      }, {
        label: 'pH Range (6.5-7.5)',
        data: [],
        borderColor: 'rgba(40, 167, 69, 0.3)',
        backgroundColor: 'rgba(40, 167, 69, 0.1)',
        borderWidth: 0,
        fill: '+1',
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: 'rgba(255, 255, 255, 0.8)',
            font: { size: 11 },
            usePointStyle: true,
            boxWidth: 6
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: 'white',
          bodyColor: 'white',
          borderColor: '#0066d6',
          borderWidth: 1,
          displayColors: false,
          callbacks: {
            title: function(context) {
              return 'Waktu: ' + context[0].label;
            },
            label: function(context) {
              if (context.datasetIndex === 0) {
                const ph = context.raw.toFixed(2);
                let status = 'Normal';
                if (ph < 6.0 || ph > 8.0) status = 'Berbahaya';
                else if (ph < 6.5 || ph > 7.5) status = 'Perhatian';
                return `pH: ${ph} (${status})`;
              }
              return '';
            }
          }
        }
      },
      scales: {
        y: {
          min: 5.5,
          max: 8.5,
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.8)',
            font: { size: 10 },
            callback: function(value) {
              return value.toFixed(1);
            }
          },
          title: {
            display: true,
            text: 'pH Level',
            color: 'rgba(255, 255, 255, 0.8)'
          }
        },
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.6)',
            font: { size: 9 },
            maxTicksLimit: 8
          },
          title: {
            display: true,
            text: 'Waktu',
            color: 'rgba(255, 255, 255, 0.8)'
          }
        }
      },
      animation: {
        duration: 0 // Disable animation for real-time updates
      }
    }
  });

  console.log('✅ Real-time pH chart initialized successfully');
  console.log('📊 Chart object:', phRealtimeChart);
  chartInitialized = true; // Mark as initialized
  
  } catch (error) {
    console.error('❌ Failed to initialize chart:', error);
    phRealtimeChart = null;
    setTimeout(initializeRealtimeChart, 2000); // Retry after 2 seconds
  }
}

function addToRealtimeChart(phValue) {
  console.log(`📈 addToRealtimeChart called with pH: ${phValue}`);
  console.log(`Chart state - phRealtimeChart exists: ${!!phRealtimeChart}, paused: ${chartPaused}, mode: ${chartMode}`);
  
  if (!phRealtimeChart || chartPaused || chartMode !== 'realtime') {
    console.log('❌ Chart update skipped - conditions not met');
    return;
  }

  console.log('✅ Adding data to real-time chart...');

  const now = new Date();
  const timeLabel = now.toLocaleTimeString('id-ID', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  });

  // Add new data point
  phRealtimeChart.data.labels.push(timeLabel);
  phRealtimeChart.data.datasets[0].data.push(phValue); // pH value
  phRealtimeChart.data.datasets[1].data.push(7.0); // Target line
  phRealtimeChart.data.datasets[2].data.push(6.5); // Range lower bound

  // Remove old points if exceeding max
  if (phRealtimeChart.data.labels.length > maxChartPoints) {
    phRealtimeChart.data.labels.shift();
    phRealtimeChart.data.datasets.forEach(dataset => {
      dataset.data.shift();
    });
  }

  // Update chart colors based on pH level
  updateChartPointColor(phValue);

  phRealtimeChart.update('none');
}

function updateChartPointColor(phValue) {
  if (!phRealtimeChart) return;

  const dataset = phRealtimeChart.data.datasets[0];
  let color = '#0066d6'; // Default blue

  if (phValue >= 6.5 && phValue <= 7.5) {
    color = '#28a745'; // Green for normal
  } else if (phValue < 4.0 || phValue > 10.0) {
    color = '#dc3545'; // Red for dangerous  
  } else {
    color = '#ffc107'; // Yellow for warning
  }

  dataset.borderColor = color;
  dataset.pointBackgroundColor = color;
  dataset.backgroundColor = color + '25';
}

function toggleChart() {
  chartPaused = !chartPaused;
  const pauseBtn = document.getElementById('chart_pause_btn');
  if (pauseBtn) {
    pauseBtn.innerHTML = chartPaused ? 
      '<i class="fas fa-play"></i> Resume' : 
      '<i class="fas fa-pause"></i> Pause';
    pauseBtn.className = chartPaused ? 'chart-btn warning' : 'chart-btn';
  }
  
  showNotification(
    chartPaused ? 'Chart paused' : 'Chart resumed', 
    chartPaused ? 'warning' : 'success'
  );
}

function clearChart() {
  if (!phRealtimeChart) return;
  
  phRealtimeChart.data.labels = [];
  phRealtimeChart.data.datasets.forEach(dataset => {
    dataset.data = [];
  });
  phRealtimeChart.update();
  
  showNotification('Chart data cleared', 'info');
}

// Load historical data for different time ranges
async function loadHistoricalData(timeRange) {
  if (!phRealtimeChart) return;
  
  // Set chart to historical mode
  chartMode = 'historical';
  
  try {
    // Show loading state
    const loadingBtn = document.querySelector(`[data-range="${timeRange}"]`);
    if (loadingBtn) {
      const originalText = loadingBtn.innerHTML;
      loadingBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
      loadingBtn.disabled = true;
    }
    
    const response = await fetch(`/api/ph_history?range=${timeRange}`);
    const data = await response.json();
    
    if (data.success && data.readings) {
      // Clear existing data
      phRealtimeChart.data.labels = [];
      phRealtimeChart.data.datasets[0].data = [];
      phRealtimeChart.data.datasets[1].data = [];
      phRealtimeChart.data.datasets[2].data = [];
      
      // Add historical data
      data.readings.forEach(reading => {
        const timestamp = new Date(reading.timestamp);
        let timeLabel;
        
        // Format time labels based on range
        if (timeRange === '1h') {
          timeLabel = timestamp.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
          });
        } else if (timeRange === '6h' || timeRange === '4h') {
          timeLabel = timestamp.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
          });
        } else { // 24h
          timeLabel = timestamp.toLocaleString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit'
          });
        }
        
        phRealtimeChart.data.labels.push(timeLabel);
        phRealtimeChart.data.datasets[0].data.push(reading.ph_value);
        phRealtimeChart.data.datasets[1].data.push(7.0); // Target line
        phRealtimeChart.data.datasets[2].data.push(6.5); // Range lower bound
      });
      
      // Update chart
      phRealtimeChart.update();
      
      // Update chart title
      updateChartTitle(timeRange, data.readings.length);
      
      console.log(`📊 Loaded ${data.readings.length} readings for ${timeRange} range`);
    } else {
      showNotification('No data available for selected range', 'warning');
    }
    
    // Restore button state
    if (loadingBtn) {
      loadingBtn.innerHTML = timeRange.toUpperCase();
      loadingBtn.disabled = false;
    }
    
  } catch (error) {
    console.error('Error loading historical data:', error);
    showNotification('Failed to load historical data', 'error');
    
    // Restore button state on error
    const loadingBtn = document.querySelector(`[data-range="${timeRange}"]`);
    if (loadingBtn) {
      loadingBtn.innerHTML = timeRange.toUpperCase();
      loadingBtn.disabled = false;
    }
  }
}

function updateChartTitle(timeRange, dataCount) {
  const chartContainer = document.querySelector('.chart-widget .widget-header h3');
  if (chartContainer) {
    chartContainer.innerHTML = `<i class="fas fa-chart-line"></i> Monitoring Real-time (${timeRange.toUpperCase()}) - ${dataCount} data`;
  }
}

function switchToLiveMode() {
  console.log('🟢 Switching to LIVE mode...');
  
  // Set to real-time mode
  chartMode = 'realtime';
  console.log(`Mode set to: ${chartMode}`);
  
  // Clear chart data
  if (phRealtimeChart) {
    console.log('🧹 Clearing chart data for LIVE mode...');
    phRealtimeChart.data.labels = [];
    phRealtimeChart.data.datasets.forEach(dataset => {
      dataset.data = [];
    });
    phRealtimeChart.update();
  } else {
    console.error('❌ Chart not initialized when switching to LIVE mode');
  }
  
  // Update button states
  document.querySelectorAll('.chart-btn[data-range]').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.chart-btn[data-mode]').forEach(b => b.classList.remove('active'));
  
  const liveBtn = document.getElementById('live_btn');
  if (liveBtn) {
    liveBtn.classList.add('active');
    console.log('✅ LIVE button activated');
  }
  
  // Update chart title
  const chartContainer = document.querySelector('.chart-widget .widget-header h3');
  if (chartContainer) {
    chartContainer.innerHTML = `<i class="fas fa-chart-line"></i> Monitoring Real-time (LIVE)`;
  }
  
  showNotification('Mode LIVE - Monitoring real-time aktif', 'success');
  console.log('✅ LIVE mode activated successfully');
}

function updatePhDisplay(data) {
  const phEl = document.getElementById('ph_value');
  const timeEl = document.getElementById('ph_time');
  const phStatusEl = document.getElementById('ph_status');
  
  // Support both 'ph' and 'ph_value' field names
  const phValue = data.ph || data.ph_value;
  const timestamp = data.timestamp || new Date().toISOString();
  
  if (phEl) phEl.textContent = parseFloat(phValue).toFixed(2);
  if (timeEl) timeEl.textContent = new Date(timestamp).toLocaleString('id-ID');
  
  // Update pH status
  if (phStatusEl) {
    const ph = parseFloat(phValue);
    let statusText, statusClass;
    
    // Use status from server if available, otherwise calculate
    if (data.ph_status) {
      statusText = data.ph_status.text;
      statusClass = data.ph_status.class;
    } else {
      if (ph >= 6.5 && ph <= 7.5) {
        statusText = "Normal";
        statusClass = "normal";
      } else if ((ph >= 6.0 && ph < 6.5) || (ph > 7.5 && ph <= 8.0)) {
        statusText = "Perhatian";
        statusClass = "warning";
      } else {
        statusText = "Berbahaya";
        statusClass = "danger";
      }
    }
    
    phStatusEl.textContent = statusText;
    phStatusEl.className = `ph-status ${statusClass}`;
  }
  
  // Add to real-time chart
  addToRealtimeChart(parseFloat(phValue));
  
  // Update readings table
  updateReadingsTable({
    ph: phValue,
    voltage: data.voltage,
    timestamp: timestamp
  });
  
  console.log(`📈 Chart updated with pH: ${phValue}`);
}

function updateReadingsTable(data) {
  const table = document.getElementById('readings_table');
  if (!table) return;
  
  const ph = parseFloat(data.ph);
  let statusBadgeClass, statusText;
  
  if (ph >= 6.5 && ph <= 7.5) {
    statusBadgeClass = "normal";
    statusText = "Normal";
  } else if ((ph >= 6.0 && ph < 6.5) || (ph > 7.5 && ph <= 8.0)) {
    statusBadgeClass = "warning";
    statusText = "Perhatian";
  } else {
    statusBadgeClass = "danger";
    statusText = "Berbahaya";
  }
  
  const voltage = data.voltage ? parseFloat(data.voltage).toFixed(2) : "-";
  const timestamp = new Date(data.timestamp).toLocaleString();
  
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>-</td>
    <td>${ph.toFixed(2)}</td>
    <td>${voltage}</td>
    <td>${timestamp}</td>
    <td><span class="status-badge ${statusBadgeClass}">${statusText}</span></td>
  `;
  
  table.prepend(row);
  
  // Keep only last 20 rows
  while (table.children.length > 20) {
    table.removeChild(table.lastChild);
  }
}

// ===== SERVO CONTROL =====
function updateServoDisplay(data) {
  const servoPositionEl = document.getElementById('servo_position');
  const servoArmEl = document.getElementById('servo_arm');
  
  if (servoPositionEl) {
    servoPositionEl.textContent = data.servo_angle + '°';
  }
  
  if (servoArmEl) {
    servoArmEl.style.transform = `rotate(${data.servo_angle}deg)`;
  }
  
  // Update pH sensor status in device status
  const phSensorStatus = document.getElementById('ph_sensor_status');
  if (phSensorStatus) {
    const statusText = data.ph_calibrated ? 'Terkalibrasi' : 'Belum Kalibrasi';
    const statusClass = data.ph_calibrated ? 'connected' : 'warning';
    phSensorStatus.innerHTML = `<i class="fas fa-circle status-dot ${statusClass}"></i> ${statusText}`;
  }
  
  // Update servo status in device monitoring
  updateServoStatus(data.servo_angle, 'Normal', 'System Update');
}

function initializeServoControl() {
  const servoRange = document.getElementById('servo_range');
  const servoVal = document.getElementById('servo_val');
  const servoPosition = document.getElementById('servo_position');
  const servoArm = document.getElementById('servo_arm');
  const servoMoveBtn = document.getElementById('servo_move_btn');
  
  if (!servoRange || !servoVal) return;
  
  // Update display as user moves slider
  servoRange.addEventListener('input', () => {
    const angle = servoRange.value;
    servoVal.textContent = angle;
    
    if (servoPosition) servoPosition.textContent = angle + '°';
    if (servoArm) {
      servoArm.style.transform = `rotate(${angle}deg)`;
    }
  });
  
  // Preset buttons
  const presetBtns = document.querySelectorAll('.preset-btn');
  presetBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const angle = this.getAttribute('data-angle');
      servoRange.value = angle;
      servoRange.dispatchEvent(new Event('input'));
    });
  });
  
  // Move servo button
  if (servoMoveBtn) {
    servoMoveBtn.addEventListener('click', async () => {
      const angle = parseInt(servoRange.value);
      const servoDeviceStatus = document.getElementById('servo_device_status');
      
      try {
        // Update status
        if (servoDeviceStatus) {
          servoDeviceStatus.innerHTML = '<i class="fas fa-circle status-dot connecting"></i> Menggerakkan...';
        }
        
        const response = await fetch('/api/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            cmd: 'servo_move', 
            detail: { angle: angle } 
          })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
          // Success
          if (servoDeviceStatus) {
            servoDeviceStatus.innerHTML = '<i class="fas fa-circle status-dot connected"></i> Berhasil dipindahkan';
          }
          
          showNotification(`Servo bergerak ke ${angle}°`, 'success');
          updateServoStatus(angle, 'Normal', 'Manual Move');
          addToActivityLog(`Servo moved to ${angle}° manually`);
          
          // Reset status after 3 seconds
          setTimeout(() => {
            if (servoDeviceStatus) {
              servoDeviceStatus.innerHTML = '<i class="fas fa-circle status-dot"></i> Siaga';
            }
          }, 3000);
          
        } else {
          throw new Error(result.error || 'Unknown error');
        }
        
      } catch (error) {
        console.error('Servo move error:', error);
        if (servoDeviceStatus) {
          servoDeviceStatus.innerHTML = '<i class="fas fa-circle status-dot disconnected"></i> Error';
        }
        showNotification('Error menggerakkan servo: ' + error.message, 'error');
      }
    });
  }
  
  console.log('✅ Servo control initialized');
}

// ===== DEVICE STATUS MONITORING =====
function initializeDeviceStatus() {
  const refreshBtn = document.getElementById('refresh_status');
  const exportBtn = document.getElementById('export_status');
  const resetBtn = document.getElementById('reset_system');
  const autoRefreshCheckbox = document.getElementById('auto_refresh_status');
  
  let autoRefreshInterval = null;
  let statusData = {
    esp32: {
      ip: '192.168.1.179',
      wifi_signal: 'Strong (-45 dBm)',
      uptime: '0m 0s'
    },
    servo: {
      position: 90,
      mode: 'Normal',
      status: 'Ready',
      last_command: 'System Start'
    },
    ph: {
      calibration: 'Not Calibrated',
      value: '--',
      adc_raw: '--',
      voltage: '-- V'
    },
    system: {
      memory_usage: '47KB / 320KB',
      flash_usage: '954KB / 1.3MB',
      temperature: '42°C',
      health: 'Healthy'
    }
  };

  function updateStatusDisplay() {
    // ESP32 Status
    const wifiStatus = document.getElementById('wifi_status');
    const esp32Ip = document.getElementById('esp32_ip');
    const wifiSignal = document.getElementById('wifi_signal');
    const esp32Uptime = document.getElementById('esp32_uptime');
    
    if (wifiStatus) wifiStatus.textContent = 'Connected';
    if (esp32Ip) esp32Ip.textContent = statusData.esp32.ip;
    if (wifiSignal) wifiSignal.textContent = statusData.esp32.wifi_signal;
    if (esp32Uptime) esp32Uptime.textContent = statusData.esp32.uptime;
    
    // Servo Status
    const servoPosition = document.getElementById('servo_current_position');
    const servoMode = document.getElementById('servo_mode');
    const servoStatusText = document.getElementById('servo_status_text');
    const servoLastCommand = document.getElementById('servo_last_command');
    
    if (servoPosition) servoPosition.textContent = statusData.servo.position + '°';
    if (servoMode) servoMode.textContent = statusData.servo.mode;
    if (servoStatusText) servoStatusText.textContent = statusData.servo.status;
    if (servoLastCommand) servoLastCommand.textContent = statusData.servo.last_command;
    
    // pH Sensor Status
    const phCalibration = document.getElementById('ph_calibration');
    const phCurrentValue = document.getElementById('ph_current_value');
    const phAdcRaw = document.getElementById('ph_adc_raw');
    const phVoltage = document.getElementById('ph_voltage');
    
    if (phCalibration) phCalibration.textContent = statusData.ph.calibration;
    if (phCurrentValue) phCurrentValue.textContent = statusData.ph.value;
    if (phAdcRaw) phAdcRaw.textContent = statusData.ph.adc_raw;
    if (phVoltage) phVoltage.textContent = statusData.ph.voltage;
    
    // System Health
    const memoryUsage = document.getElementById('memory_usage');
    const flashUsage = document.getElementById('flash_usage');
    const chipTemp = document.getElementById('chip_temp');
    const systemHealth = document.getElementById('system_health');
    
    if (memoryUsage) memoryUsage.textContent = statusData.system.memory_usage;
    if (flashUsage) flashUsage.textContent = statusData.system.flash_usage;
    if (chipTemp) chipTemp.textContent = statusData.system.temperature;
    if (systemHealth) systemHealth.textContent = statusData.system.health;
    
    // Update timestamp
    const lastUpdate = document.getElementById('last_status_update');
    if (lastUpdate) lastUpdate.textContent = new Date().toLocaleTimeString();
  }

  function fetchDeviceStatus() {
    fetch('/api/device_status')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Merge with existing data
          Object.assign(statusData, data.status);
          updateStatusDisplay();
          console.log('✅ Device status updated');
        } else {
          console.log('⚠️ Device status fetch failed:', data.error);
        }
      })
      .catch(error => {
        console.log('⚠️ Failed to fetch device status:', error);
        showNotification('Failed to fetch device status', 'warning');
      });
  }

  // Event listeners
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
      fetchDeviceStatus();
      setTimeout(() => {
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Status';
      }, 1000);
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const report = {
        timestamp: new Date().toISOString(),
        device_status: statusData
      };
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `device_status_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showNotification('Device status exported', 'success');
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Apakah Anda yakin ingin restart ESP32? Perangkat akan terputus sementara.')) {
        fetch('/api/restart_esp32', { method: 'POST' })
          .then(response => response.json())
          .then(data => {
            showNotification(data.message || 'Restart command sent to ESP32', 'info');
          })
          .catch(error => {
            showNotification('Failed to send restart command', 'error');
          });
      }
    });
  }

  if (autoRefreshCheckbox) {
    autoRefreshCheckbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        autoRefreshInterval = setInterval(fetchDeviceStatus, 5000);
        showNotification('Auto-refresh enabled (5s interval)', 'info');
      } else {
        if (autoRefreshInterval) {
          clearInterval(autoRefreshInterval);
          autoRefreshInterval = null;
        }
        showNotification('Auto-refresh disabled', 'info');
      }
    });
  }

  // Initial status display
  updateStatusDisplay();
  
  // Start auto-refresh if checkbox is checked
  if (autoRefreshCheckbox && autoRefreshCheckbox.checked) {
    autoRefreshInterval = setInterval(fetchDeviceStatus, 5000);
  }

  console.log('✅ Device status monitoring initialized');
}

// Update servo status in device monitoring
function updateServoStatus(position, mode = 'Normal', command = 'Manual Move') {
  const positionElement = document.getElementById('servo_current_position');
  const modeElement = document.getElementById('servo_mode');
  const commandElement = document.getElementById('servo_last_command');
  
  if (positionElement) positionElement.textContent = position + '°';
  if (modeElement) modeElement.textContent = mode;
  if (commandElement) commandElement.textContent = command;
}

// ===== UTILITY FUNCTIONS =====
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 1000;
    padding: 12px 20px; border-radius: 4px; color: white;
    font-weight: bold; opacity: 0; transition: opacity 0.3s;
    max-width: 300px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  `;
  
  // Set color based on type
  switch(type) {
    case 'success': notification.style.backgroundColor = '#4CAF50'; break;
    case 'error': notification.style.backgroundColor = '#f44336'; break;
    case 'warning': notification.style.backgroundColor = '#ff9800'; break;
    default: notification.style.backgroundColor = '#2196F3';
  }
  
  document.body.appendChild(notification);
  
  setTimeout(() => notification.style.opacity = '1', 10);
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

function addToActivityLog(message) {
  const logContainer = document.getElementById('activity_log');
  if (!logContainer) return;
  
  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry';
  
  const timestamp = new Date().toLocaleTimeString();
  logEntry.innerHTML = `
    <span class="log-time">${timestamp}</span>
    <span class="log-message"><i class="fas fa-cog"></i> ${message}</span>
  `;
  
  // Add to top of log
  logContainer.insertBefore(logEntry, logContainer.firstChild);
  
  // Keep only latest 10 entries
  while (logContainer.children.length > 10) {
    logContainer.removeChild(logContainer.lastChild);
  }
}

// ===== OTHER CONTROLS =====
function initializeOtherControls() {
  // Dispense buffer button
  const dispenseBtn = document.getElementById('dispense_btn');
  if (dispenseBtn) {
    dispenseBtn.addEventListener('click', async () => {
      try {
        const response = await fetch('/api/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cmd: 'dispense_buffer', detail: 'manual_button' })
        });
        
        const result = await response.json();
        if (response.ok) {
          showNotification('Buffer dispense command sent', 'success');
          addToActivityLog('Buffer dispensed manually');
        } else {
          throw new Error(result.error || 'Failed to send command');
        }
      } catch (error) {
        showNotification('Error: ' + error.message, 'error');
      }
    });
  }
  
  // Table search functionality
  const searchInput = document.getElementById('table_search');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      const searchTerm = this.value.toLowerCase();
      const table = document.getElementById('readings_table');
      
      if (table) {
        const rows = table.getElementsByTagName('tr');
        
        for (let i = 0; i < rows.length; i++) {
          const rowText = rows[i].textContent.toLowerCase();
          rows[i].style.display = rowText.includes(searchTerm) ? '' : 'none';
        }
      }
    });
  }
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 pH Controller app initializing...');
  
  // Wait for Chart.js to be loaded
  function waitForChart() {
    if (typeof Chart !== 'undefined') {
      console.log('✅ Chart.js library loaded');
      // Initialize components
      initializeServoControl();
      initializeOtherControls();
      initializeRealtimeChart(); // Initialize real-time chart
      
      // Initialize device status monitoring if on control page
      if (document.getElementById('refresh_status')) {
        initializeDeviceStatus();
      }
    } else {
      console.log('⏳ Waiting for Chart.js library...');
      setTimeout(waitForChart, 100);
    }
  }
  
  waitForChart();
  
  // Add chart control event listeners
  const pauseBtn = document.getElementById('chart_pause_btn');
  if (pauseBtn) {
    pauseBtn.addEventListener('click', toggleChart);
  }
  
  const clearBtn = document.getElementById('chart_clear_btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearChart);
  }
  
  // Chart range buttons
  document.querySelectorAll('.chart-btn[data-range]').forEach(btn => {
    btn.addEventListener('click', () => {
      const range = btn.dataset.range;
      if (range) {
        document.querySelectorAll('.chart-btn[data-range]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadHistoricalData(range);
        showNotification(`Menampilkan data ${range.toUpperCase()}`, 'info');
      }
    });
  });

  // LIVE button for real-time mode
  const liveBtn = document.getElementById('live_btn');
  if (liveBtn) {
    liveBtn.addEventListener('click', () => {
      switchToLiveMode();
    });
  }

  // Start in LIVE mode by default
  setTimeout(() => {
    switchToLiveMode();
  }, 500);
  
  console.log('✅ pH Controller app fully initialized');
});