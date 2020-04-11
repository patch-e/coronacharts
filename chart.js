$(function() {
    const devMode = false;
    const url = devMode ? 'http://localhost:4000/nodejs/corona' : '/nodejs/corona';

    $.get(url, function(data) {
        setColorPreference();

        const parsedData = parseData(data);
        const config = createConfig(parsedData.labels, parsedData.datasets);

        activateChart(config);
        activateButtons();
    });
});

function parseData(data) {
    document.getElementById('rawDataContainer').innerText = JSON.stringify(data, null, 2);

    const dateLabels = [... new Set(data.map(data => data.date))];
    const countyData = [... new Set(data.map(data => data.name))];
    
    let countyCases = [];
    for (const county of countyData) {
        let result = data.filter(obj => {
            return obj.name === county;
        });
        
        let color = getRandomColor();
        
        let dataset = {};
        dataset.backgroundColor = color;
        dataset.borderColor = color;
        dataset.fill = false;
        dataset.label = county;
        dataset.lineTension = 0;
        let cases = [];
        for (i = 0; i < result.length; i++) {
            cases.push(result[i].cases);
        }
        dataset.data = cases;
        
        countyCases.push(dataset);
    };

    return { 
        datasets: countyCases,
        labels: dateLabels
    };
};

function createConfig(labels, datasets) {
    return {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets.reverse()
        },
        options: {
            maintainAspectRatio: false,
            responsive: true,
            tooltips: {
                mode: 'index',
                intersect: false,
                itemSort: function(a, b) {
                    return (b.yLabel - a.yLabel);
                }
            },
            hover: {
                mode: 'nearest',
                intersect: true
            },
            scales: {
                xAxes: [{
                    display: true,
                    scaleLabel: {
                        display: true,
                        labelString: 'Date'
                    },
                    gridLines: {
                        color: window.gridLinesColor
                    }
                }],
                yAxes: getDefaultAxes()
            }
        }
    };
};

function activateChart(config) {
    const context = document.getElementById('canvas').getContext('2d');
    window.lineChart = new Chart(context, config);
};

function activateButtons() {
    $('.dropdown-menu button').on('click', updateCartesian);
};

function updateCartesian(event) {
    const type = event.target.id;
    window.lineChart.options.scales.yAxes = ( type === 'linear' ? getLinearAxes() : getLogarithmicAxes() );
    window.lineChart.update();
};

function getDefaultAxes() {
    return getLogarithmicAxes();
};

function getLinearAxes() {
    return [{
        display: true,
        type: 'linear',
        scaleLabel: {
            display: true,
            labelString: 'Total Cases'
        },
        gridLines: {
            color: window.gridLinesColor,
            zeroLineColor: window.gridLinesColor
        }
    }];
};

function getLogarithmicAxes() {
    return [{
        display: true,
        type: 'logarithmic',
        ticks: {
            callback: function(value) {
                return value;
            }
        },
        scaleLabel: {
            display: true,
            labelString: 'Total Cases'
        },
        gridLines: {
            color: window.gridLinesColor,
            zeroLineColor: window.gridLinesColor
        }
    }];
};

function setColorPreference() {
    const prefersDarkMode = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    window.gridLinesColor = prefersDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
};

function getRandomColor() {
    let letters = '0123456789ABCDEF'.split('');
    let color = '#';
    
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    
    return color;
};