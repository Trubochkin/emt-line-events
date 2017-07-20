import config from 'app/core/config';

import {CanvasPanelCtrl} from './canvas-metric';
import DistinctPoints from './points';

import _ from 'lodash';
import moment from 'moment';
import angular from 'angular';
import kbn from 'app/core/utils/kbn';
/*import {/!*coreModule,*!/ appEvents} from  'app/core/core';*/
import appEvents from 'app/core/app_events';

class DiscretePanelCtrl extends CanvasPanelCtrl {

  constructor($scope, $injector, $q, $http, $modal, alertSrv, datasourceSrv, backendSrv) {
    super($scope, $injector, $q);
    this.data = null;
    this.$http = $http;
    this.alertSrv = alertSrv;
    this.appEvents = appEvents;

/*    console.log('panel-$scope ', $scope);
    console.log('panel-datasourceSrv ', datasourceSrv);*/
    /*console.log('panel-backendSrv ', backendSrv);*/
    // Set and populate defaults
    var panelDefaults = {
      rowHeight: 50,
      valueMaps: [
        { value: 'null', op: '=', text: 'N/A' }
      ],
      mappingTypes: [
        {name: 'value to text', value: 1},
        {name: 'range to text', value: 2},
      ],
      rangeMaps: [
        { from: 'null', to: 'null', text: 'N/A' }
      ],
      colorMaps: [
        { text: 'N/A', color: '#CCC' }
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
      legendSortBy: '-ms'
    };
    _.defaults(this.panel, panelDefaults);
    this.externalPT = false;    //флаг положения курсора (false - над текущим графиком, true - над другим)

    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    this.events.on('render', this.onRender.bind(this));
    this.events.on('data-received', this.onDataReceived.bind(this));
    this.events.on('data-error', this.onDataError.bind(this));
    this.events.on('refresh', this.onRefresh.bind(this));
    this.updateColorInfo();
  }

  onDataError(err) {
    console.log("onDataError", err);
  }

  onInitEditMode() {
    this.addEditorTab('Options', 'public/plugins/emt-discrete-panel/editor.html',1);
    this.addEditorTab('Legend', 'public/plugins/emt-discrete-panel/legend.html',3);
    this.addEditorTab('Colors', 'public/plugins/emt-discrete-panel/colors.html',4);
    this.addEditorTab('Mappings', 'public/plugins/emt-discrete-panel/mappings.html', 5);
    this.editorTabIndex = 1;
    this.refresh();
  }

  onRender() {
    if(this.data == null ||  !(this.context) ) {
      return;
    }

    /*console.log( 'render', this.data);*/

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

    // ctx.shadowOffsetX = 1;
    // ctx.shadowOffsetY = 1;
    // ctx.shadowColor = "rgba(0,0,0,0.3)";
    // ctx.shadowBlur = 3;

    var top = 0;

    var elapsed = this.range.to - this.range.from;

    _.forEach(this.data, (metric) => {
      var centerV = top + (rowHeight/2);

      // The no-data line
      ctx.fillStyle = this.panel.backgroundColor;
      ctx.fillRect(0, top, width, rowHeight);

      /*if(!this.panel.writeMetricNames) {
        ctx.fillStyle = "#111111";
        ctx.textAlign = 'left';
        ctx.fillText("No Data", 10, centerV);
      }*/

      var lastBS = 0;
      var point = metric.changes[0];
      for(var i=0; i<metric.changes.length; i++) {
        point = metric.changes[i];
        if(point.start <= this.range.to) {
          var xt = Math.max( point.start - this.range.from, 0 );
          point.x = (xt / elapsed) * width;
          ctx.fillStyle = this.getColor( point.val );
          ctx.fillRect(point.x, top, width, rowHeight);

          if(this.panel.writeAllValues) {
            ctx.fillStyle = this.panel.valueTextColor;
            ctx.textAlign = 'left';
            ctx.fillText(point.val, point.x+7, centerV);
          }
          lastBS = point.x;
        }
      }



      if(top>0) {
        ctx.strokeStyle = this.panel.lineColor;
        ctx.beginPath();
        ctx.moveTo(0, top);
        ctx.lineTo(width, top);
        ctx.stroke();
      }

      ctx.fillStyle = "#000000";

      if( this.panel.writeMetricNames &&
          this.mouse.position == null &&
        (!this.panel.highlightOnMouseover || this.panel.highlightOnMouseover )
      ) {
        ctx.fillStyle = this.panel.metricNameColor;
        ctx.textAlign = 'left';
        ctx.fillText( metric.name, 10, centerV);
      }

      ctx.textAlign = 'right';

      if( this.mouse.down == null ) {
        if( this.panel.highlightOnMouseover && this.mouse.position != null ) {
          point = metric.changes[0];
          var next = null;
          for(var i=0; i<metric.changes.length; i++) {
            if(metric.changes[i].start > this.mouse.position.ts) {
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

          if(next != null) {
            ctx.beginPath();
            ctx.fillRect(next.x, top, width, rowHeight);
            ctx.fill();
          }
          ctx.globalCompositeOperation = 'source-over';

          // Now Draw the value
          ctx.fillStyle = "#000000";
          ctx.textAlign = 'left';
          ctx.fillText( point.val, point.x+7, centerV);
        }
        else if( this.panel.writeLastValue ) {
          ctx.fillText( point.val, width-7, centerV );
        }
      }

      top += rowHeight;
    });


    if(this.mouse.position != null ) {
      if(this.mouse.down != null) {
        var xmin = Math.min( this.mouse.position.x, this.mouse.down.x);
        var xmax = Math.max( this.mouse.position.x, this.mouse.down.x);

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
        // если положение курсора находится на другом графике и если рядов больше 1
        if(this.externalPT && rows>1) {
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

  showLegandTooltip(pos, info) {
    var body = '<div class="graph-tooltip-time">'+ info.val +'</div>';

    body += "<center>";
    if(info.count > 1) {
      body += info.count + " times<br/>for<br/>";
    }
    body += moment.duration(info.ms).humanize();
    if(info.count > 1) {
      body += "<br/>total";
    }
    body += "</center>"

    this.$tooltip.html(body).place_tt(pos.pageX + 20, pos.pageY);
  }

  clearTT() {
    this.$tooltip.detach();
  }

  formatValue(val, stats) {

    if(_.isNumber(val) && this.panel.rangeMaps) {
      for (var i = 0; i < this.panel.rangeMaps.length; i++) {
        var map = this.panel.rangeMaps[i];

        // value/number to range mapping
        var from = parseFloat(map.from);
        var to = parseFloat(map.to);
        if (to >= val && from <= val) {
          return map.text;
        }
      }
    }

    var isNull = _.isNil(val);
    if(!isNull && !_.isString(val)) {
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

      if(val == map.value) {
        return map.text;
      }
    }

    if(isNull) {
      return "null";
    }
    return val;
  }

  getColor(val) {
    if(_.has(this.colorMap, val)) {
      return this.colorMap[val];
    }

    var palet = [
      '#FF4444',
      '#9933CC',
      '#32D1DF',
      '#ed2e18',
      '#CC3900',
      '#F79520',
      '#33B5E5'
    ];

    return palet[ Math.abs(this.hashCode(val+'')) % palet.length ];
  }

  randomColor() {
    var letters = 'ABCDE'.split('');
    var color = '#';
    for (var i=0; i<3; i++ ) {
        color += letters[Math.floor(Math.random() * letters.length)];
    }
    return color;
  }

  hashCode(str){
    var hash = 0;
    if (str.length == 0) return hash;
    for (var i = 0; i < str.length; i++) {
      var char = str.charCodeAt(i);
      hash = ((hash<<5)-hash)+char;
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
      "__interval":     {text: this.interval,   value: this.interval},
      "__interval_ms":  {text: this.intervalMs, value: this.intervalMs},
    });

    var range = this.range;
    var rangeRaw = this.rangeRaw;
    if(this.panel.expandFromQueryS > 0) {
      range = {
        from: this.range.from.clone(),
        to: this.range.to
      };
      range.from.subtract( this.panel.expandFromQueryS, 's' );

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
      testField: "helloWorld =)"
    };
    /*console.log("panel-disccrete-metricsQuery: ", metricsQuery);*/
    return datasource.query(metricsQuery);
  }

  onDataReceived(dataList) {
    $(this.canvas).css( 'cursor', 'pointer' );

    /*console.log('GOT', dataList);*/

    var data = [];
    _.forEach(dataList, (metric) => {
      if('table'=== metric.type) {
        if('time' != metric.columns[0].type) {
          throw 'Expected a time column from the table format';
        }

        var last = null;
        for(var i=1; i<metric.columns.length; i++) {
          var res = new DistinctPoints(metric.columns[i].text);
          for(var j=0; j<metric.rows.length; j++) {
            var row = metric.rows[j];
            res.add( row[0], this.formatValue( row[i] ) );
          }
          res.finish( this );
          data.push( res );
        }
      }
      else {
        var res = new DistinctPoints( metric.target );
        _.forEach(metric.datapoints, (point) => {
          res.add( point[1], this.formatValue(point[0]) );
        });
        res.finish( this );
        data.push( res );
      }
    });
    this.data = data;

    this.onRender();

    //console.log( 'data', dataList, this.data);
  }

  writeToDB(data){
    this.$http({
        url: this.datasource.url + '/write/comment',
        method: 'POST',
        data: data,
        headers: {
            "Content-Type": "application/json"
        }
    }).then((rsp) => {
        console.log( "Annotation saved", rsp );
        this.alertSrv.set('Saved', 'Successfully saved the comment', 'success', 3000);
    }, err => {
        console.log( "ERROR", err );
        this.error = err.data.error + " ["+err.status+"]";
        this.alertSrv.set('Oops', 'Something went wrong: '+this.error, 'error', 6000);
    });
  }

  removeColorMap(map) {
    var index = _.indexOf(this.panel.colorMaps, map);
    this.panel.colorMaps.splice(index, 1);
    this.updateColorInfo();
  };

  updateColorInfo() {
    var cm = {};
    for(var i=0; i<this.panel.colorMaps.length; i++) {
      var m = this.panel.colorMaps[i];
      if(m.text) {
        cm[m.text] = m.color;
      }
    }
    this.colorMap = cm;
    this.render();
  }

  addColorMap(what) {
    if(what == 'curent') {
      _.forEach(this.data, (metric) => {
        if(metric.legendInfo) {
          _.forEach(metric.legendInfo, (info) => {
            if(!_.has(info.val)) {
              this.panel.colorMaps.push({text: info.val, color: this.getColor(info.val) });
            }
          });
        }
      });
    }
    else {
      this.panel.colorMaps.push({text: '???', color: this.randomColor() });
    }
    this.updateColorInfo();
  }

  removeValueMap(map) {
    var index = _.indexOf(this.panel.valueMaps, map);
    this.panel.valueMaps.splice(index, 1);
    this.render();
  };

  addValueMap() {
    this.panel.valueMaps.push({value: '', op: '=', text: '' });
  }

  removeRangeMap(rangeMap) {
    var index = _.indexOf(this.panel.rangeMaps, rangeMap);
    this.panel.rangeMaps.splice(index, 1);
    this.render();
  };

  addRangeMap() {
    this.panel.rangeMaps.push({from: '', to: '', text: ''});
  }

  onConfigChanged() {
    //console.log( "Config changed...");
    this.render();
  }

  getLegendDisplay(info, metric) {
    var disp = info.val;
    if(this.panel.showLegendPercent || this.panel.showLegendCounts || this.panel.showLegendTime) {
      disp += " (";
      var hassomething = false;
      if(this.panel.showLegendTime) {
        disp += moment.duration(info.ms).humanize();
        hassomething = true;
      }

      if(this.panel.showLegendPercent) {
        if(hassomething) {
          disp += ", ";
        }

        var dec = this.panel.legendPercentDecimals;
        if(_.isNil(dec)) {
          if(info.per>.98 && metric.changes.length>1) {
            dec = 2;
          }
          else if(info.per<0.02) {
            dec = 2;
          }
          else {
            dec = 0;
          }
        }
        disp += kbn.valueFormats.percentunit(info.per, dec);
        hassomething = true;
      }

      if(this.panel.showLegendCounts) {
        if(hassomething) {
          disp += ", ";
        }
        disp += info.count+"x";
      }
      disp += ")";
    }
    return disp;
  }

  //------------------
  // Mouse Events
  //------------------

  showTooltip(evt, point, isExternal) {
    /*console.log("panel-module-showTooltip", evt, point, isExternal);*/
    var from = point.start;
    var to = point.start + point.ms;
    var time = point.ms;
    var val = point.val;

    if(this.mouse.down != null) {
      from = Math.min(this.mouse.down.ts, this.mouse.position.ts);
      to   = Math.max(this.mouse.down.ts, this.mouse.position.ts);
      time = to - from;
      val = "Zoom To:";
    }

    var body = '<div class="graph-tooltip-time">'+ val + '</div>';

    body += "<center>"
    body += this.dashboard.formatDate( moment(from) ) + "<br/>";
    body += "to<br/>";
    body += this.dashboard.formatDate( moment(to) ) + "<br/><br/>";
    body += moment.duration(time).humanize() + "<br/>";
    body += "</center>"

    var pageX = 0;
    var pageY = 0;
    if(isExternal) {
      var rect = this.canvas.getBoundingClientRect();
      pageY = rect.top + (evt.pos.panelRelY * rect.height);
      if(pageY < 0 || pageY > $(window).innerHeight()) {
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
  };

  onGraphHover(evt, showTT, isExternal) {
    /*console.log( 'panel-module-onGraphHover', evt, showTT, isExternal);*/
    console.log( 'panel-module-this.data', this.data);
    console.log( 'panel-module-this.mouse.position', this.mouse.position);
    console.log( 'panel-module-this.this.panel.rowHeight', this.panel.rowHeight);
    this.externalPT = false;
    if(this.data) {
      var hover = null;
      var j = Math.floor(this.mouse.position.y/this.panel.rowHeight);
      if (j < 0) {
        j = 0;
      }
      if (j >= this.data.length) {
        j = this.data.length-1;
      }
      hover = this.data[j].changes[0];
      for(var i=0; i<this.data[j].changes.length; i++) {
        if(this.data[j].changes[i].start > this.mouse.position.ts) {
          break;
        }
        /*hover = this.data[j].changes[i];*/
      }
      this.hoverPoint = hover;

      if(showTT) {
        this.externalPT = isExternal;
        this.showTooltip( evt, hover, isExternal );
      }
      this.onRender(); // refresh the view
    }
    else {
      this.$tooltip.detach(); // make sure it is hidden
    }
  }

  onMouseClicked(where) {
    var pt = this.hoverPoint;
    if(pt) {
      /*var range = {from: moment.utc(pt.start), to: moment.utc(pt.start+pt.ms) };
      this.timeSrv.setTime(range);
      this.clear();*/
    }
    console.log(pt);
    appEvents.emit('show-modal', {
        src: 'public/plugins/emt-discrete-panel/addComment.html',
        modalClass: 'confirm-modal',
        scope: true,
        model: {}
    });
  }

  onMouseSelectedRange(range) {
    this.timeSrv.setTime(range);
    this.clear();
  }

  clear() {
    this.mouse.position = null;
    this.mouse.down = null;
    this.hoverPoint = null;
    $(this.canvas).css( 'cursor', 'wait' );
    appEvents.emit('graph-hover-clear');
    this.render();
  }
}
DiscretePanelCtrl.templateUrl = 'module.html';
export {
  DiscretePanelCtrl as PanelCtrl
};


