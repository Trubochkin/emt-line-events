import _ from 'lodash';
import moment from 'moment';
import angular from 'angular';
import kbn from 'app/core/utils/kbn';

export class TableOptionCtrl {
    constructor($scope, $q){
        $scope.editor = this;
        this.activeStyleIndex = 0;
        this.panelCtrl = $scope.ctrl;
        this.panel = this.panelCtrl.panel;
        this.unitFormats = kbn.getUnitFormats();
    }
}

/** @ngInject */
export function tableOptionsTab($q, uiSegmentSrv) {
    'use strict';
    return {
        restrict: 'E',
        scope: true,
        templateUrl: 'public/plugins/emt-line-events/table.html',
        controller: TableOptionCtrl,
    };
}