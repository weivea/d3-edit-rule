/**
 * Created by weijianli on 16/7/16.
 */
import d3RiskRules from './components/riskRules'
(function (win) {
  if(module && module.exports){
    module.exports = d3RiskRules;
  }
  if(win){
    win.xy = win.xy || {};
    win.xy.d3RiskRules = d3RiskRules;
  }
})(window);