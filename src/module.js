import config from 'app/core/config';
import {CanvasPanelCtrl} from './canvas-metric';
import DistinctPoints from './points';

import _ from 'lodash';
import moment from 'moment';
import angular from 'angular';
import kbn from 'app/core/utils/kbn';
/*import {/!*coreModule,*!/ appEvents} from  'app/core/core';*/
import appEvents from 'app/core/app_events';
import {loadPluginCss} from 'app/plugins/sdk';
import {tableOptionsTab} from './table';

loadPluginCss({
    dark: 'plugins/emt-line-events/css/line-events.dark.css',
    light: 'plugins/emt-line-events/css/line-events.light.css'
});

class DiscretePanelCtrl extends CanvasPanelCtrl {

    constructor($scope, $injector, $q, $http, alertSrv, datasourceSrv, contextSrv, $rootScope) {
        super($scope, $injector, $q);
        this.data = null;
        this.$http = $http;
        this.$scope = $scope;
        this.alertSrv = alertSrv;
        this.appEvents = appEvents;
        this.comment = "";
        this.max = 64;
        this.saveForm = null;
        this.$rootScope = $rootScope;
        //console.log('panel-datasourceSrv ', datasourceSrv);

        // Set and populate defaults
        var panelDefaults = {
            rowHeight: 50,
            valueMaps: [
                {value: 'null', op: '=', text: 'N/A'}
            ],
            mappingTypes: [
                {name: 'value to text', value: 1},
                {name: 'range to text', value: 2},
            ],
            /*rangeMaps: [
             { from: 'null', to: 'null', text: 'N/A' }
             ],*/
            colorMaps: [
                /*{text: 'N/A', color: '#CCC'}*/
            ],
            metricNameColor: '#000000',
            valueTextColor: '#000000',
            backgroundColor: 'rgba(128, 128, 128, 0.1)',
            lineColor: 'rgba(128, 128, 128, 1.0)',
            textSize: 24,
            writeLastValue: true,
            writeAllValues: false,
            writeMetricNames: false,
            showLegend: true,
            showLegendNames: true,
            showLegendValues: true,
            showLegendPercent: true,
            highlightOnMouseover: true,
            legendSortBy: '-ms',
            setOwnColors: false,
            showGraph: true,
            showTable: false,
            dataTable: {
                headerNames: ['Time', 'Metric', 'Event-name', 'Comment']
            }
        };
        _.defaults(this.panel, panelDefaults);
        this.externalPT = false;    //флаг положения курсора (false - над текущим графиком, true - над другим)
        this.dataWriteDB = {
            panelId: '',
            user: {
                orgName: contextSrv.user.orgName,
                orgRole: contextSrv.user.orgRole,
                email: contextSrv.user.email,
                login: contextSrv.user.login
            },
            target: '',
            datapoint: {
                pointNumber: "",
                time: "",
                pointName: "",
                commentText: "",
                fillColor: ""
            }
        };


        this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
        this.events.on('render', this.onRender.bind(this));
        this.events.on('data-received', this.onDataReceived.bind(this));
        this.events.on('data-error', this.onDataError.bind(this));
        //this.events.on('refresh', this.onRefresh.bind(this));
        this.updateColorInfo();
    }

    onDataError(err) {
        console.log("onDataError", err);
    }

    onInitEditMode() {
        this.addEditorTab('Options', 'public/plugins/emt-line-events/editor.html', 2);
        this.addEditorTab('Legend', 'public/plugins/emt-line-events/legend.html', 3);
        this.addEditorTab('Colors', 'public/plugins/emt-line-events/colors.html', 4);
        this.addEditorTab('Mappings', 'public/plugins/emt-line-events/mappings.html', 5);
        this.addEditorTab('Table', tableOptionsTab, 6);
        this.editorTabIndex = 1;
        this.refresh();
    }

    onRender() {
        if (this.panel.showGraph) {
            if (!(this.context)) {
                console.log('render-no-context');
                return;
            }
            if (!this.data) {
                console.log('render-data-empty', this.data);
                return;
            }

            //console.log( 'render-data-OK');

            var rect = this.wrap.getBoundingClientRect();
            var rows = this.data.length;
            var rowHeight = this.panel.rowHeight;

            var height = rowHeight * rows;
            var width = rect.width;
            this.canvas.width = width;
            this.canvas.height = height;
            var ctx = this.context;
            ctx.lineWidth = 1;
            ctx.textBaseline = 'middle';
            ctx.font = this.panel.textSize + 'px "Open Sans", Helvetica, Arial, sans-serif';

            /*ctx.shadowOffsetX = 1;
             ctx.shadowOffsetY = 1;
             ctx.shadowColor = "rgba(0,0,0,0.3)";
             ctx.shadowBlur = 3;*/

            var top = 0;

            var elapsed = this.range.to - this.range.from;

            _.forEach(this.data, (metric) => {
                var centerV = top + (rowHeight / 2);
                // The no-data line
                ctx.fillStyle = this.panel.backgroundColor;
                ctx.fillRect(0, top, width, rowHeight);

                if (!this.panel.writeMetricNames) {
                    ctx.fillStyle = "#111111";
                    ctx.textAlign = 'left';
                    ctx.fillText("No Data", 10, centerV);
                }

                var lastBS = 0;
                var point = metric.changes[0];

                for (var i = 0; i < metric.changes.length; i++) {
                    point = metric.changes[i];
                    if (point.start <= this.range.to) {
                        var xt = Math.max(point.start - this.range.from, 0);
                        /*console.log( 'point', point);*/
                        point.x = (xt / elapsed) * width;
                        /* ctx.fillStyle = this.getColor( point.val );*/
                        ctx.fillStyle = this.panel.setOwnColors ? this.getColor(point) : point.color;
                        ctx.fillRect(point.x, top, width, rowHeight);

                        if (this.panel.writeAllValues) {
                            ctx.fillStyle = this.panel.valueTextColor;
                            ctx.textAlign = 'left';
                            ctx.fillText(point.val, point.x + 7, centerV);
                        }
                        lastBS = point.x;
                    }
                }

                if (top > 0) {
                    ctx.strokeStyle = this.panel.lineColor;
                    ctx.beginPath();
                    ctx.moveTo(0, top);
                    ctx.lineTo(width, top);
                    ctx.stroke();
                }

                ctx.fillStyle = "#000000";
                if (this.panel.writeMetricNames &&
                    this.mouse.position == null &&
                    (!this.panel.highlightOnMouseover || this.panel.highlightOnMouseover )
                ) {
                    ctx.fillStyle = this.panel.metricNameColor;
                    ctx.textAlign = 'left';
                    ctx.fillText(metric.name.split('.').join(' - '), 10, centerV);
                }
                ctx.textAlign = 'right';
                if (this.mouse.down == null) {
                    /*console.log( 'this.mouse.position', this.mouse.position);*/
                    if (this.panel.highlightOnMouseover && this.mouse.position != null) {
                        point = metric.changes[0];
                        var next = null;
                        for (var i = 0; i < metric.changes.length; i++) {
                            if (metric.changes[i].start > this.mouse.position.ts) {
                                next = metric.changes[i];
                                break;
                            }
                            point = metric.changes[i];
                        }

                        // Fill canvas using 'destination-out' and alpha at 0.05
                        ctx.globalCompositeOperation = 'destination-out';
                        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
                        ctx.beginPath();
                        ctx.fillRect(0, top, point.x, rowHeight);
                        ctx.fill();
                        if (next != null) {
                            ctx.beginPath();
                            ctx.fillRect(next.x, top, width, rowHeight);
                            ctx.fill();
                        }
                        ctx.globalCompositeOperation = 'source-over';

                        // Now Draw the value
                        ctx.fillStyle = "#000000";
                        ctx.textAlign = 'left';
                        ctx.fillText(point.val, point.x + 7, centerV);
                    }
                    else if (this.panel.writeLastValue) {
                        ctx.fillText(point.val, width - 7, centerV);
                    }
                }

                top += rowHeight;
            });


            if (this.mouse.position != null) {
                if (this.mouse.down != null) {
                    var xmin = Math.min(this.mouse.position.x, this.mouse.down.x);
                    var xmax = Math.max(this.mouse.position.x, this.mouse.down.x);

                    // Fill canvas using 'destination-out' and alpha at 0.05
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
                    ctx.beginPath();
                    ctx.fillRect(0, 0, xmin, height);
                    ctx.fill();

                    ctx.beginPath();
                    ctx.fillRect(xmax, 0, width, height);
                    ctx.fill();
                    ctx.globalCompositeOperation = 'source-over';
                }
                else {
                    ctx.strokeStyle = '#111';
                    ctx.beginPath();
                    ctx.moveTo(this.mouse.position.x, 0);
                    ctx.lineTo(this.mouse.position.x, height);
                    ctx.lineWidth = 3;
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(this.mouse.position.x, 0);
                    ctx.lineTo(this.mouse.position.x, height);
                    ctx.strokeStyle = '#e22c14';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    // если положение курсора находится на другом графике и если рядов больше 1 - показывать точку
                    if (this.externalPT && rows > 1) {
                        ctx.beginPath();
                        ctx.arc(this.mouse.position.x, this.mouse.position.y, 3, 0, 2 * Math.PI, false);
                        ctx.fillStyle = '#e22c14';
                        ctx.fill();
                        ctx.lineWidth = 1;
                        ctx.strokeStyle = '#111';
                        ctx.stroke();
                    }
                }
            }
        }
        if (this.panel.showTable) {
            console.log('DATA-TABLE-RENDER: ', this.data);
            $('.table-panel-table-body-inner-emt').empty();
            var dataThis = this;

            _.forEach(this.data, function (dPoints, index) {
                _.forEach(dPoints.changes, function (datapoint, index) {
                    if (datapoint.ms === 0) return;
                    var fillColor = dataThis.panel.setOwnColors ? dataThis.getColor(datapoint) : datapoint.color;
                    $('.table-panel-table-body-inner-emt').append(
                        '<tr class="row-emt">' +
                        '<td class="cel-emt width-14">' + moment(datapoint.start).format('YYYY-MM-DD HH:mm:ss') + '</td>' +
                        '<td class="cel-emt width-12">' + dPoints.name.split('.')[2].slice(2) + '</td>' +
                        '<td class="cel-emt width-14">' +
                        '           <div style="width:10px; ' +
                        'height:10px; ' +
                        'display:inline-block; ' +
                        'background-color: ' + fillColor + '; ' +
                        'margin: 0px 10px 0px 0px">' +
                        '</div>' +
                        datapoint.val +
                        '</td>' +
                        '<td style="cursor: pointer;" data-index=' + index + '>' + datapoint.comment + '</td>' +
                        '</tr>>');
                });
            });
        }
    }

    showLegandTooltip(pos, info) {
        var body = '<div class="graph-tooltip-time">' + info.val + '</div>';

        body += "<center>";
        if (info.count > 1) {
            body += info.count + " times<br/>for<br/>";
        }
        body += moment.duration(info.ms).humanize();
        if (info.count > 1) {
            body += "<br/>total";
        }
        body += "</center>"

        this.$tooltip.html(body).place_tt(pos.pageX + 20, pos.pageY);
    }

    clearTT() {
        this.$tooltip.detach();
    }

    formatValue(val, stats) {
        /*if(_.isNumber(val) && this.panel.rangeMaps) {
         for (var i = 0; i < this.panel.rangeMaps.length; i++) {
         var map = this.panel.rangeMaps[i];

         // value/number to range mapping
         var from = parseFloat(map.from);
         var to = parseFloat(map.to);
         if (to >= val && from <= val) {
         return map.text;
         }
         }
         }*/

        var isNull = _.isNil(val);
        if (!isNull && !_.isString(val)) {
            val = val.toString(); // convert everything to a string
        }

        for (var i = 0; i < this.panel.valueMaps.length; i++) {
            var map = this.panel.valueMaps[i];
            // special null case
            if (map.value === 'null') {
                if (isNull) {
                    return map.text;
                }
                continue;
            }

            if (val == map.value) {
                return map.text;
            }
        }

        if (isNull) {
            return "null";
        }
        return val;
    }

    getColor(info) {
        if (_.has(this.colorMap, info.val) && this.panel.setOwnColors) {
            return this.colorMap[info.val];
        }
        return info.color;
        /*var palet = [
         '#FF4444',
         '#9933CC',
         '#32D1DF',
         '#ed2e18',
         '#CC3900',
         '#F79520',
         '#33B5E5'
         ];

         return palet[ Math.abs(this.hashCode(info.val+'')) % palet.length ];*/
    }

    randomColor() {
        var letters = 'ABCDE'.split('');
        var color = '#';
        for (var i = 0; i < 3; i++) {
            color += letters[Math.floor(Math.random() * letters.length)];
        }
        return color;
    }

    hashCode(str) {
        var hash = 0;
        if (str.length == 0) return hash;
        for (var i = 0; i < str.length; i++) {
            var char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }

    // Copied from Metrics Panel, only used to expand the 'from' query
    issueQueries(datasource) {
        this.datasource = datasource;
        if (!this.panel.targets || this.panel.targets.length === 0) {
            return this.$q.when([]);
        }

        // make shallow copy of scoped vars,
        // and add built in variables interval and interval_ms
        var scopedVars = Object.assign({}, this.panel.scopedVars, {
            "__interval": {text: this.interval, value: this.interval},
            "__interval_ms": {text: this.intervalMs, value: this.intervalMs},
        });

        var range = this.range;
        var rangeRaw = this.rangeRaw;
        if (this.panel.expandFromQueryS > 0) {
            range = {
                from: this.range.from.clone(),
                to: this.range.to
            };
            range.from.subtract(this.panel.expandFromQueryS, 's');

            rangeRaw = {
                from: range.from.format(),
                to: this.rangeRaw.to
            };
        }

        var metricsQuery = {
            panelId: this.panel.id,
            range: range,
            rangeRaw: rangeRaw,
            interval: this.interval,
            intervalMs: this.intervalMs,
            targets: this.panel.targets,
            format: this.panel.renderer === 'png' ? 'png' : 'json',
            maxDataPoints: this.resolution,
            scopedVars: scopedVars,
            cacheTimeout: this.panel.cacheTimeout,
            panelType: this.panel.type
        };
        return datasource.query(metricsQuery);
    }

    onDataReceived(dataList) {
        $(this.canvas).css('cursor', 'pointer');
        /*console.log('GOT', dataList);*/
        var data = [];
        _.forEach(dataList, (metric) => {
            if ('table' === metric.type) {
                if ('time' != metric.columns[0].type) {
                    throw 'Expected a time column from the table format';
                }
                var last = null;
                for (var i = 1; i < metric.columns.length; i++) {
                    var res = new DistinctPoints(metric.columns[i].text);
                    for (var j = 0; j < metric.rows.length; j++) {
                        var row = metric.rows[j];
                        res.add(row[0], this.formatValue(row[i]));
                    }
                    res.finish(this);
                    data.push(res);
                }
            }
            else {
                var res = new DistinctPoints(metric.target);
                _.forEach(metric.datapoints, (point) => {
                    // point: [0]-valNum, [1]-time, [2]- valString, [3]-commentText, [4]-fillColor
                    res.add(+point[1], this.formatValue(point[2]), point[3], point[4], point[0]);
                });
                res.finish(this);
                data.push(res);
            }
        });
        this.data = data;
        //console.log( 'data-received');
        this.render();
    }

    removeColorMap(map) {
        var index = _.indexOf(this.panel.colorMaps, map);
        this.panel.colorMaps.splice(index, 1);
        this.updateColorInfo();
    }

    removeAllColorMap() {
        this.panel.colorMaps.splice(0);
        this.updateColorInfo();
    }

    updateColorInfo() {
        var cm = {};
        for (var i = 0; i < this.panel.colorMaps.length; i++) {
            var m = this.panel.colorMaps[i];
            if (m.text) {
                cm[m.text] = m.color;
            }
        }
        this.colorMap = cm;
        this.render();
    }

    addColorMap(what) {
        if (what == 'curent') {
            _.forEach(this.data, (metric) => {
                /*console.log('metric.legendInfo', metric.legendInfo);*/
                if (metric.legendInfo) {
                    _.forEach(metric.legendInfo, (info) => {
                        if (_.findIndex(this.panel.colorMaps, function (obj) {
                                return obj.text == info.val;
                            }) == -1) {
                            this.panel.colorMaps.push({text: info.val, color: this.getColor(info)});
                        }
                        /*if(!_.has(info.val)) {
                         this.panel.colorMaps.push({text: info.val, color: this.getColor(info) });
                         }*/
                    });
                }
            });
        }
        else {
            this.panel.colorMaps.push({text: '???', color: this.randomColor()});
        }
        this.updateColorInfo();
    }

    removeValueMap(map) {
        var index = _.indexOf(this.panel.valueMaps, map);
        this.panel.valueMaps.splice(index, 1);
        this.render();
    }

    addValueMap() {
        this.panel.valueMaps.push({value: '', op: '=', text: ''});
    }

    /*removeRangeMap(rangeMap) {
     var index = _.indexOf(this.panel.rangeMaps, rangeMap);
     this.panel.rangeMaps.splice(index, 1);
     this.render();
     };*/

    /*addRangeMap() {
     this.panel.rangeMaps.push({from: '', to: '', text: ''});
     }*/

    onConfigChanged() {
        //console.log( "Config changed...");
        /*this.timeSrv.refreshDashboard();*/
        this.render();
    }

    getLegendDisplay(info, metric) {
        /*console.log('getLegendDisplay', info, metric);*/
        /* console.log('getLegendDisplay', info);*/
        var disp = info.val;
        if (this.panel.showLegendPercent || this.panel.showLegendCounts || this.panel.showLegendTime) {
            disp += " (";
            var hassomething = false;
            if (this.panel.showLegendTime) {
                disp += moment.duration(info.ms).humanize();
                hassomething = true;
            }

            if (this.panel.showLegendPercent) {
                if (hassomething) {
                    disp += ", ";
                }

                var dec = this.panel.legendPercentDecimals;
                if (_.isNil(dec)) {
                    if (info.per > .98 && metric.changes.length > 1) {
                        dec = 2;
                    }
                    else if (info.per < 0.02) {
                        dec = 2;
                    }
                    else {
                        dec = 0;
                    }
                }
                disp += kbn.valueFormats.percentunit(info.per, dec);
                hassomething = true;
            }

            if (this.panel.showLegendCounts) {
                if (hassomething) {
                    disp += ", ";
                }
                disp += info.count + "x";
            }
            disp += ")";
        }
        return disp;
    }

    //------------------
    // Mouse Events
    //------------------

    showTooltip(evt, point, isExternal) {
        /*console.log("showTooltip - point.val", point.val);*/
        var from = point.start;
        var to = point.start + point.ms;
        var time = point.ms;
        var val = point.val;

        if (this.mouse.down != null) {
            from = Math.min(this.mouse.down.ts, this.mouse.position.ts);
            to = Math.max(this.mouse.down.ts, this.mouse.position.ts);
            time = to - from;
            val = "Zoom To:";
        }

        /* var j = Math.floor(this.mouse.position.y/this.panel.rowHeight);
         if (j < 0) {
         j = 0;
         }
         if (j >= this.data.length) {
         j = this.data.length-1;
         }*/
        /*var body = '<div class="graph-tooltip-time">'+*/
        /* var body = '<div class="graph-tooltip-time">'+evt.panel.targets[j].target+'</div>';*/
        var body = '<div>';
        body += '<div style="background-color:' + this.getColor(point) + '; width:10px; height:10px; display:inline-block;"></div>' +
            '<b>' + '  ' + val + '</b></br>';

        body += '<b style="display: inline-block; width: 40px">From: </b>' + this.dashboard.formatDate(moment(from)) + "<br/>";
        body += '<b style="display: inline-block; width: 40px">To: </b>' + this.dashboard.formatDate(moment(to)) + "<br/>";
        body += '<b>Duration: </b>' + moment.duration(time).humanize() + '</br>';

        body += '<div style="padding:0px 5px; margin:0px; background-color:#00fff0; color:#000"><b>' + point.comment + '</b></div>';
        body += '</div>';

        var pageX = 0;
        var pageY = 0;
        if (isExternal) {
            var rect = this.canvas.getBoundingClientRect();
            pageY = rect.top + (evt.pos.panelRelY * rect.height);
            if (pageY < 0 || pageY > $(window).innerHeight()) {
                // Skip Hidden tooltip
                this.$tooltip.detach();
                return;
            }
            pageY += $(window).scrollTop();

            var elapsed = this.range.to - this.range.from;
            var pX = (evt.pos.x - this.range.from) / elapsed;
            pageX = rect.left + (pX * rect.width);
        }
        else {
            pageX = evt.evt.pageX;
            pageY = evt.evt.pageY;
        }
        this.$tooltip.html(body).place_tt(pageX + 20, pageY + 5);
    }

    binSearchIndexPoint(arrChanges, mouseTimePosition) {
        if ((arrChanges.length == 0) || (mouseTimePosition < arrChanges[0].start) || (mouseTimePosition > arrChanges[arrChanges.length - 1].start)) {
            return null;
        }
        var first = 0;
        var last = arrChanges.length;
        // Если просматриваемый участок не пуст, first < last
        while (first < last) {
            var mid = Math.floor(first + (last - first) / 2);
            if (mouseTimePosition <= arrChanges[mid].start)
                last = mid;
            else
                first = mid + 1;
        }
        // Теперь last может указывать на искомый элемент массива.
        if (arrChanges[last].start >= mouseTimePosition)
            return last - 1;
        else
            return null;
    };

    onGraphHover(evt, showTT, isExternal) {
        /*console.log( 'onGraphHover-evt', evt);*/
        this.externalPT = false;
        if (this.data) {
            var hover = null;
            var j = Math.floor(this.mouse.position.y / this.panel.rowHeight);
            if (j < 0) {
                j = 0;
            }
            if (j >= this.data.length) {
                j = this.data.length - 1;
            }
            hover = this.data[j].changes[0];

            // Линейный поиск (менее быстрый)
            /*for(var i=0; i<this.data[j].changes.length; i++) {
             if(this.data[j].changes[i].start > this.mouse.position.ts) {
             break;
             }
             hover = this.data[j].changes[i];
             }*/
            // Бинарный поиск (более быстрый)
            var i = this.binSearchIndexPoint(this.data[j].changes, this.mouse.position.ts)
            if (i) {
                hover = this.data[j].changes[i];
            }
            this.hoverPoint = hover;

            if (showTT) {
                this.externalPT = isExternal;
                this.showTooltip(evt, hover, isExternal);
            }

            /*var time = performance.now();*/
            this.render(); // refresh the view
            /*time = performance.now() - time;
             console.log('Время выполнения onRender = ', time);*/
        }
        else {
            this.$tooltip.detach(); // make sure it is hidden
        }
    }

    writeToDB(data) {
        /*
         if (!this.saveForm.$valid) {
         return;
         }
         */
        this.$http({
            url: this.datasource.url + '/update/line-status',
            method: 'POST',
            data: data,
            headers: {
                "Content-Type": "application/json"
            }
        }).then((rsp) => {
            console.log("saved", rsp);
            this.alertSrv.set('Saved', 'Successfully saved the comment', 'success', 3000);
            this.$rootScope.$broadcast('refresh');
        }, err => {
            console.log("errorrrrrrr", err);
            this.error = err.data.error + " [" + err.status + "]";
            this.alertSrv.set('Oops', 'Something went wrong: ' + this.error, 'error', 6000);
        });
    }

    onMouseClicked(where) {
        var pt = this.hoverPoint;
        /*    if(pt) {
         var range = {from: moment.utc(pt.start), to: moment.utc(pt.start+pt.ms) };
         this.timeSrv.setTime(range);
         this.clear();
         }*/
        /*this.hoverPoint.comment = where;
         console.log("panel-onMouseClicked-this.hoverPoint", this.hoverPoint);
         appEvents.emit('show-modal', {
         src: 'public/plugins/emt-discrete-panel/addComment.html',
         modalClass: 'confirm-modal',
         model: {}
         });*/

        if (this.data) {
            var dataPoint = null;
            var j = Math.floor(where.y / this.panel.rowHeight);
            if (j < 0) {
                j = 0;
            }
            if (j >= this.data.length) {
                j = this.data.length - 1;
            }
            dataPoint = this.data[j].changes[0];

            // Бинарный поиск (более быстрый)
            var i = this.binSearchIndexPoint(this.data[j].changes, where.ts)
            if (i) {
                dataPoint = this.data[j].changes[i];
            }
            /*console.log("dataPoint", dataPoint);*/
        }

        var modalScope = this.$scope.$new(true);
        modalScope.ctrl = this;
        modalScope.ctrl.dataWriteDB.datapoint.fillColor = dataPoint.color;
        modalScope.ctrl.dataWriteDB.datapoint.commentText = dataPoint.comment;
        modalScope.ctrl.dataWriteDB.datapoint.pointName = dataPoint.val;
        modalScope.ctrl.dataWriteDB.datapoint.pointNumber = dataPoint.numVal;
        modalScope.ctrl.dataWriteDB.datapoint.time = dataPoint.start;
        modalScope.ctrl.dataWriteDB.target = this.data[j].name;
        modalScope.ctrl.dataWriteDB.panelId = this.panel.id;
        /*console.log("panel-onMouseClicked-modalScope", modalScope);*/

        this.publishAppEvent('show-modal', {
            src: 'public/plugins/emt-line-events/addComment.html',
            scope: modalScope,
            modalClass: 'modal--narrow confirm-modal'
        });

    }

    onMouseSelectedRange(range) {
        this.timeSrv.setTime(range);
        this.clear();
    }

    clear() {
        //console.log("clear()");
        this.mouse.position = null;
        this.mouse.down = null;
        this.hoverPoint = null;
        $(this.canvas).css('cursor', 'wait');
        appEvents.emit('graph-hover-clear');
        this.render();
    }
}
DiscretePanelCtrl.templateUrl = 'module.html';
export {
    DiscretePanelCtrl as PanelCtrl
};


