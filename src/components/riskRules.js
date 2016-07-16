/**
 * Created by weijianli on 16/6/14.
 */

import "babel-polyfill";
import './riskRules.less';
import riskRulesTpl from './riskRules.html'
import netMap from './netMap'
const defaultOpt = {
  id:'risk-rules',
  height:600,
  autoDistanceX:100,
  autoDistanceY:100
};


class d3RiskRules {
  constructor(opt){
    var self = this;
    this.opt = Object.assign(defaultOpt,opt);//配置项


    this.container = document.getElementById(this.opt.id);//容器
    this.container.style.display = 'block';
    this.container.style.padding = 0;
    this.container.innerHTML = riskRulesTpl;

    document.querySelector(`#${this.opt.id} .risk-rules-box`).style.height = this.opt.height+'px';

    this.box = document.querySelector(`#${this.opt.id} .box`);//


    this.svg = d3.select(this.box).append('svg')//画板
                                  .attr('width',this.box.offsetWidth)
                                  .attr('height',this.box.offsetHeight);
    this.group = this.svg.append('g').classed('g-board',true);//画组
    this.pictureL = this.group.append('g').classed('p-board-l',true);//画儿-线
    this.picture = this.group.append('g').classed('p-board',true);//画儿-点
    this.groupTranslate = {x:0,y:0};//画组位移


    this.editBox = {//文字编辑框
      el:document.querySelector(`#${this.opt.id} .edit-text`),
      input:document.querySelector(`#${this.opt.id} .edit-text input`),
      cancel:document.querySelector(`#${this.opt.id} .edit-text .btn1`),
      save:document.querySelector(`#${this.opt.id} .edit-text form`),
      onCancel:null,
      onSave:null
    };


    this.menu = null;//菜单框框
    this.menus = {};//菜单
    this.menuKey = null;//菜单对应的节点key

    this.atomList = d3.select(`#${this.opt.id} .atom-list`);//原子列表
    this.tplList = d3.select(`#${this.opt.id} .tpl-list`);//模板列表
    this.atomItems = null;//原子
    this.ruleItems = null;//规则
    this.tplItems = null;//模板
    this.tplNodeCnt = 0;//模板的节点计数器
    this.nodes = {};//规则节点(数据)
    this.linesMap = new netMap()//连线的节点关系数据结构[ this.linesMap.set(from,tar) ]
    this.linesMap.getTagSByFrom = this.linesMap.getValuesByKey;//获取与出发节点相关的关系
    this.linesMap.getFromsByTag = this.linesMap.getKeysByValue;//获取与到达节点相关的关系
    this.linesMap.delFromsByTag = this.linesMap.delKeysByValue;//删除与到达节点相关的关系
    this.linesMap.delTagsByFrom = this.linesMap.delValuesBykey;//删除与出发节点相关的关系

    
    
    this.nodesEL = {};//规则节点(元素)
    this.linesEL = {};//连线(元素)

    this.lineGenerator = d3.line()//线的path构建器
      .x(function(d) { return d.x; })
      .y(function(d) { return d.y; });
    this.lineMaker = function (array) {
      if(array.length ==2){
        var middle = {x:(array[0].x+array[1].x)/2,y:(array[0].y+array[1].y)/2};
        return self.lineGenerator([array[0],middle,array[1]]);
      }
    };

    this.movingLine = {//正在跟随鼠标画的一条线
      line:null,//线
      fromKey:null,//起点节点的key
      p1:{x:'',y:''},//起点
      p2:{x:'',y:''}//终点
    };


    //box对右键菜单和点击事件的相应
    this.box.oncontextmenu = this.box.onclick = function (e) {
      if(e.target.nodeName != 'circle'){
        if(self.menuKey){
          var position = self.nodes[self.menuKey].position;
          self.menuKey = null;
          self.hideMenu(position);
        }
      }
      if(e.type == 'contextmenu'){
        if(self.movingLine.line){
          self.movingLine.line.remove();
          self.movingLine.line=null;
        }
        return false;
      }
    };

    //svg上鼠标移动
    this.svg.on('mousemove',function () {
      var e = d3.event;
      if(self.movingLine.line){
        self.drawMoveLine(e);
      }
    });

    //拖动画布
    this.svg.call(d3.drag().on("start", function (d) {
      self.svg.style('cursor','move');
      d3.event.on("drag", dragged).on("end", ended);
      function dragged() {
        if(!self.movingLine.line){
          var e = d3.event;
          self.groupTranslate.x += e.dx;
          self.groupTranslate.y += e.dy;
          self.group.attr("transform",`translate(${self.groupTranslate.x},${self.groupTranslate.y})`)
        }
      }
      function ended() {
        self.svg.style('cursor',null);
      }
    }));
    
    this.makeMenu();//节点的右键菜单
    this.editTextInit();//文字编辑初始化
    this.initArrow();//初始化连线箭头

    this.initSvg();
  }

  initSvg(){
    var self = this;
    var oldOnresizeFun;
    if(window.onresize){
      oldOnresizeFun = window.onresize;
    }
    window.onresize = function () {
      self.svg
        .attr('width',self.box.offsetWidth)
        .attr('height',self.box.offsetHeight);
      if(typeof oldOnresizeFun == 'function'){
        oldOnresizeFun();
      }
    }
  }

  //文字编辑初始化
  editTextInit(){
    var self = this;
    self.editBox.cancel.onclick = () => {
      if(self.editBox.onCancel){self.editBox.onCancel(self.editBox.input.value)}
      self.editBox.el.style.display = 'none';
      self.editBox.onCancel = null;
      self.editBox.onSave = null;
    };
    self.editBox.save.onsubmit = (e) => {
      e.preventDefault();
      if(self.editBox.onSave){self.editBox.onSave(self.editBox.input.value)}
      self.editBox.el.style.display = 'none';
      self.editBox.onCancel = null;
      self.editBox.onSave = null;
    };
  }
  //文字编辑
  editText(text,cb){
    var self = this;
    self.editBox.onSave = cb;
    self.editBox.el.style.display = 'block';
    self.editBox.input.value = text;
  }
  //初始化连线箭头
  initArrow(){
    var defs = this.picture.append("defs");
    var arrowMarker = defs.append("marker")
      .attr("id","arrow")
      .attr("markerUnits","strokeWidth")
      .attr("markerWidth","12")
      .attr("markerHeight","12")
      .attr("viewBox","0 0 12 12")
      .attr("refX","6")
      .attr("refY","6")
      .attr("orient","auto");

    var arrow_path = "M2,2 L10,6 L2,10 L6,6 L2,2";
    arrowMarker.append("path")
      .attr("d",arrow_path)
      .attr("fill","blue");
  }
  

  //节点的右键菜单
  makeMenu(){
    var self = this;
    this.menu = this.group.append('g').classed('menu',true).attr("transform","scale(0.00001,0.00001)");

    var arc = d3.arc();  //弧生成器
    var arc1 = {
      id:"rr-menu1",//删除按钮
      text:"delete",
      mx:5,
      innerRadius: 25,
      outerRadius: 45,
      startAngle: 0 - Math.PI / 4,
      endAngle: Math.PI / 4
    };
    var arc2 = {
      id:"rr-menu2",//连线按钮
      text:"lineTo",
      mx:22,
      innerRadius: 45,
      outerRadius: 65,
      startAngle: 0 - Math.PI / 4,
      endAngle: Math.PI / 4
    };
    var arcs = [arc1,arc2];//
    this.menus.btn = this.menu.selectAll(".menu-btn")
      .data(arcs)
      .enter()
      .append('path')
      .classed('menu-btn',true)
      .attr("fill",'#ccc')
      .attr('stroke','#f0f0f0')
      .attr('stroke-width',1)
      .style('cursor','pointer')
      .attr("d",function (d) {
        return arc(d);
      }).on('mouseover',function (d) {
        d3.select(this).attr("fill",'#eee');
      })
      .on('mouseout',function (d) {
        d3.select(this).attr("fill",'#ccc');
      })
      .on('click',function (d){
        var e = d3.event;

        if(d.id == 'rr-menu1'){//删除节点
          self.delNode(self.menuKey);
        }else if(d.id == 'rr-menu2'){//连线
          self.startDrawMoveLine(e,self.menuKey);
        }
      });

    this.menu.selectAll(".menu-path")
      .data(arcs)
      .enter()
      .append('path')
      .classed('menu-path',true)
      .attr('id',function (d) {
        return d.id;
      })
      .attr("fill",'transparent')
      .attr('stroke','transparent')
      .attr('stroke-width',1)
      .style('pointer-events','none')
      .attr("d",function (d) {
        var tmp = Object.assign(d,{outerRadius: d.outerRadius-16});
        return arc(tmp);
      });

    this.menus.text = this.menu.selectAll(".menu-text")
      .data(arcs)
      .enter()
      .append('text')
      .classed('menu-text',true)
      .attr('dx', function (d) {
        return d.mx;
      })
      .style('fill', '#333')
      .style('font-size', '13px')
      .style('pointer-events','none')
      .append('textPath')
      .attr('xlink:href', function (d) {
        return `#${d.id}`;
      })
      .text(function (d) {
        return d.text;
      });
  }
  
  hideMenu(position){
    var self = this;
    self.menu
      .transition()
      .duration(300)
      .attr("transform",`translate(${position.x},${position.y}) scale(0.00001,0.00001)`);
    setTimeout(function () {
      self.menu
        .transition()
        .attr("transform","translate(-100,-100) scale(0.00001,0.00001)");
    },300);
  }
  
  
  //影藏指定菜单按钮,ids为JSON类型
  hideMenuBtn(ids){
    this.menus.text.style('fill', function (d) {
      if(ids[d.id]){
        return 'transparent';
      }else {
        return '#333';
      }
    });
    this.menus.btn
      .attr('fill', (d) => {if(ids[d.id]){return 'transparent';}else {return '#ccc';}})
      .attr('stroke', (d) => {if(ids[d.id]){return 'transparent';}else {return '#f0f0f0';}})
      .style('pointer-events', (d) => {if(ids[d.id]){return 'none';}else {return 'all';}});
  }


  //设置规则
  setRules(data){
    if(Object.prototype.toString.call(data) != "[object Array]"){
      throw new Error("setAtomRule() needs arguments that is Array type like [{id:1,text:'宝气'},{id:2,text:'宝宝'}]");
    }
    data.map(function (item) {
      if (typeof item != 'object'){
        throw new Error("setAtomRule() needs arguments that is Array type like [{id:1,text:'宝气'},{id:2,text:'宝宝'}]");
      }
      item._upper = true;
      return item;
    })
    this.setAtomRule('ruleItems',data);
  }

  //设置原子
  setAtoms(data){
    if(Object.prototype.toString.call(data) != "[object Array]"){
      throw new Error("setAtomRule() needs arguments that is Array type like [{id:1,text:'宝气'},{id:2,text:'宝宝'}]");
    }
    this.setAtomRule('atomItems',data);
  }
  //设置模板
  setTpls(data){
    if(Object.prototype.toString.call(data) != "[object Array]"){
      throw new Error("setAtomRule() needs arguments that is Array type");
    }
    this.setAtomRule('tplItems',data);
  }
  //设置原子规则
  setAtomRule(itemType,data){
    this.atomList.selectAll(`.item.${itemType}`)
      .remove();
    if(itemType == 'atomItems'){
      this[itemType] = this.atomList.selectAll(`.item.${itemType}`)
        .data(data)
        .enter()
        .append('div');
    }else if(itemType == 'ruleItems'){
      this[itemType] = this.atomList.selectAll(`.item.${itemType}`)
        .data(data)
        .enter()
        .insert('div','#risk-rules-split-line');
    }else if(itemType == 'tplItems'){
      this[itemType] = this.tplList.selectAll(`.item.${itemType}`)
        .data(data)
        .enter()
        .append('div');
    }else {
      return;
    }
    

    this[itemType].classed('item',true).classed(itemType,true)
      .classed('_upper',function (d){
        return d._upper;
      })
      .attr('title',function (d) {
        return d.text;
      })
      .html(function (d) {
        return d.text;
      });
    this.initAtomRule(itemType);
  }
  //初始化原子规则
  initAtomRule(itemType){
    var self = this;
    this[itemType].call(d3.drag().on("start", function (d) {
      var e = d3.event;
      this.style.position = 'fixed';
      this.style.top = (e.sourceEvent.clientY - 10)+'px';
      this.style.left = (e.sourceEvent.clientX - 15)+'px';
      d3.event.on("drag", dragged).on("end", ended);
      function dragged() {
        var e = d3.event;
        this.style.top = (e.sourceEvent.clientY - 10)+'px';
        this.style.left = (e.sourceEvent.clientX - 15)+'px';
      }
      function ended() {
        var e = d3.event;
        this.style.position = null;
        this.style.top = null;
        this.style.left = null;
        var x = e.sourceEvent.pageX - getLeft(self.box)-self.groupTranslate.x;
        var y = e.sourceEvent.pageY - getTop(self.box)-self.groupTranslate.y;
        if(x>0 && y>0 && x<self.box.offsetWidth && y < self.box.offsetHeight){

          
          if(itemType == 'tplItems'){
            //画棵树
            self.loadDataStruct(Object.assign({},d.data),{x,y})
          }else {
            //画个圈圈
            var key = 'n' + (new Date()).getTime();
            self.nodes[key] = {
              data: Object.assign({},d),
              position: {
                x: x,
                y: y
              }
            };
            self.drawNode(key);
          }
        }
      }
    }));
  }



  //画节点
  drawNode(key){
    var self = this;
    var circle = self.picture.append("circle")
      .classed(key,true)
      .attr('data-key',key)
      .attr('r',10)
      .style('stroke',function (d) {
        var re = '#777';
        if(self.nodes[key].data._upper){
          re = '#00acf0';
        }
        return re;
      })
      .style('fill','rgba(255,255,255,0.8)')
      .style('stroke-width',2)
      .attr('cx',self.nodes[key].position.x)
      .attr('cy',self.nodes[key].position.y)
      .on('mousedown',function (d) {
        //鼠标左键按下
        var e = d3.event;
        if(e.button == 2){
          self.menuKey = key;
          var nodeData = self.nodes[key];
          var x = nodeData.position.x;
          var y = nodeData.position.y;


          //判断是否连线到别人过,连过就不显示连线菜单了
          if(self.hasLinkedTo(key)){
            self.hideMenuBtn({'rr-menu2':true});

          }else {
            self.hideMenuBtn({});

          }
          self.menu
            .attr("transform",`translate(${x},${y}) scale(0.00001,0.00001)`);
          self.menu
            .transition()
            .duration(300)
            .attr("transform",`translate(${x},${y}) scale(1,1)`);
        }
      })
      .on('click',function () {
        if(self.movingLine.line){
          self.drawLinkLine(self.movingLine.fromKey,key)
        }else {//收起或放开树形结构
          self.nodeTreeOpenClose(key);
        }
      })
      .call(d3.drag().on("start", function (d) {

        var $this = self.nodesEL[key].circle;
        var $text = self.nodesEL[key].text;
        if(self.menuKey == key){
          var x = self.nodes[key].position.x;
          var y = self.nodes[key].position.y;
          self.menu
            .transition()
            .duration(300)
            .attr("transform",`translate(${x},${y}) scale(0.00001,0.00001)`);
        }
        var startX = self.nodes[key].position.x;
        var startY = self.nodes[key].position.y;

        d3.event.on("drag", dragged).on("end", ended);
        function dragged() {
          var e = d3.event;

          //移动节点
          $this
            .attr('cx',e.x)
            .attr('cy',e.y);
          $text
            .attr("x", e.x+15)
            .attr("y", e.y+6);
          self.nodes[key].position.x = e.x;
          self.nodes[key].position.y = e.y;

          //移动连线
            self.moveLinkLineByNode(key);
        }
        function ended() {
          //移动菜单
          if(self.menuKey == key){
            var x = self.nodes[key].position.x;
            var y = self.nodes[key].position.y;
            self.menu
              .attr("transform",`translate(${x},${y}) scale(0.00001,0.00001)`);
            self.menu
              .transition()
              .duration(300)
              .attr("transform",`translate(${x},${y}) scale(1,1)`);
          }
          //移动子节点和线
          if(self.nodes[key]._close){
            var moveX = self.nodes[key].position.x - startX;
            var moveY = self.nodes[key].position.y - startY;
            self.nodeTreeMove(key,moveX,moveY);
          }
        }
      }));

    var text = self.picture.append("text")
      .classed(key,true)
      .style("fill", function (d) {
        var re = '#777';
        if(self.nodes[key].data._upper){
          re = '#00acf0';
        }
        return re;
      })
      .attr("x", self.nodes[key].position.x+15)
      .attr("y", self.nodes[key].position.y+6)
      .attr('text-anchor','start')
      .style('font-size','12pt')
      .style('cursor',function () {
        var re = 'not-allowed';
        if(self.nodes[key].data._upper){
          re = 'text';
        }
        return re;
      })
      .text(self.nodes[key].data.text)
      .on('dblclick',function () {
        var e = d3.event;
        var $this = d3.select(this);

        if(self.nodes[key].data._upper){
          self.editText(self.nodes[key].data.text,(newText)=>{
            $this.text(newText);
            self.nodes[key].data.text = newText;
          })
        }
      });

    self.nodesEL[key]={circle,text};
  }

  //移动被隐藏二叉树结构
  nodeTreeMove(key,moveX,moveY){
    var self = this;
    var NodesLines = self.findSubNodesLines(key,true);

    //先子节点
    NodesLines.nodeKeys.forEach(function (nodeKey) {
      self.nodes[nodeKey].position.x = self.nodes[nodeKey].position.x + moveX;
      self.nodes[nodeKey].position.y = self.nodes[nodeKey].position.y + moveY;
      self.nodesEL[nodeKey].circle
        .attr('cx',self.nodes[key].position.x)
        .attr('cy',self.nodes[key].position.y);
    });

    //再连线
    NodesLines.lineKeys.forEach(function (lineKey) {
      var tmp = lineKey.split('-');
      var fromP = self.nodes[tmp[0]].position;
      var targetP = self.nodes[tmp[1]].position;
      var d = self.lineMaker([fromP,targetP]);
      self.linesEL[lineKey].attr('d',d)
    });
  }
  //显示/隐藏二叉树
  nodeTreeOpenClose(key){
    var self = this;
    var nodeData = self.nodes[key];
    if(!nodeData.data._upper){//非规则节点,就不玩儿
      return;
    }
    var NodesLines = self.findSubNodesLines(key,false);

    if(!NodesLines){//没有子节点,也不玩儿了
      return;
    }
    if(nodeData._close){//表示是关着的,要打开
      //本节点
      self.nodesEL[key].circle
        .style('fill','rgba(255,255,255,0.8)');
      //子节点
      NodesLines.nodeKeys.forEach(function (nodeKey) {
        self.nodesEL[nodeKey].circle
          .style('pointer-events','all')
          .transition()
          .duration(300)
          .attr('cx',self.nodes[nodeKey].position.x)
          .attr('cy',self.nodes[nodeKey].position.y)
          .style('stroke', function () {
            if(self.nodes[nodeKey].data._upper){
              return '#00acf0';
            }else{
              return '#777';
            }
          })
          .style('fill',function () {
            if(self.nodes[nodeKey]._close){
              return 'rgba(0, 172, 240,0.6)';
            }else{
              return 'rgba(255, 255, 255, 0.8)';
            }
          });
        self.nodesEL[nodeKey].text
          .style('pointer-events','all')
          .attr("x", self.nodes[nodeKey].position.x+15)
          .attr("y", self.nodes[nodeKey].position.y+6)
          .transition()
          .duration(300)
          .style('fill',function () {
            if(self.nodes[nodeKey].data._upper){
              return '#00acf0';
            }else{
              return '#777';
            }
          })


      });


      //线
      NodesLines.lineKeys.forEach(function (lineKey) {
        self.linesEL[lineKey]
          .style('pointer-events','all')
          .style('stroke','blue')
          .attr("marker-mid","url(#arrow)");
      });


      nodeData._close = false;
    }else {//开着的.要关闭

      //本节点
      self.nodesEL[key].circle
        .style('fill','rgba(0, 172, 240, 0.6)');
      //子节点
      NodesLines.nodeKeys.forEach(function (nodeKey) {
        self.nodesEL[nodeKey].circle
          .style('pointer-events','none')
          .transition()
          .duration(300)
          .attr('cx',nodeData.position.x)
          .attr('cy',nodeData.position.y)
          .style('stroke','transparent')
          .style('fill','transparent');
        self.nodesEL[nodeKey].text
          .style('pointer-events','none')
          .style('fill','transparent')
      });


      //线
      NodesLines.lineKeys.forEach(function (lineKey) {
        self.linesEL[lineKey]
          .style('pointer-events','none')
          .style('stroke','transparent')
          .attr("marker-mid",null);
      });
      nodeData._close = true;
    }


  }

  findSubNodesLines(key,recursionHidden){
    var self = this;
    var lineKeys = [];
    var nodeKeys = [];

    var froms = self.linesMap.getFromsByTag(key);
    if(froms){
      froms.forEach(function (from) {
        nodeKeys.push(from);
        lineKeys.push(`${from}-${key}`);
        if(recursionHidden || !self.nodes[from]._close){//如果不递归被影藏的node,则,没有被关闭的才继续往下
          var re = self.findSubNodesLines(from,recursionHidden);
          if(re){
            lineKeys = [...lineKeys, ...re.lineKeys];
            nodeKeys = [...nodeKeys, ...re.nodeKeys];
          }
        }
      });
    }else {
      return false;
    }
    return{lineKeys,nodeKeys};
  }

  //删除节点
  delNode(key,recursion){
    var self = this;

    if(recursion || self.nodes[key]._close){//递归删除
      if(self.nodes[key].data._upper){
        var fromKeys = self.linesMap.getFromsByTag(key);
        if(fromKeys){
          fromKeys.forEach(function (fromKey) {
            self.delNode(fromKey,true);
          })
        }
      }
    }

    //先删除连线
    var tars = self.linesMap.getTagSByFrom(key);
    if(tars){
      tars.forEach(function (tar) {
        self.linesEL[`${key}-${tar}`].remove();
        delete self.linesEL[`${key}-${tar}`];
      })
    }
    var froms = self.linesMap.getFromsByTag(key);
    if(froms){
      froms.forEach(function (from) {
        self.linesEL[`${from}-${key}`].remove();
        delete self.linesEL[`${from}-${key}`];
      })
    }

    //再删节点连线关系
    self.linesMap.delFromsByTag(key);
    self.linesMap.delTagsByFrom(key);

    //再删圈圈
    self.nodesEL[key].circle.remove();
    self.nodesEL[key].text.remove();
    delete  self.nodesEL[key];

    //隐藏菜单
    if(self.nodes[self.menuKey]){
      var position = self.nodes[self.menuKey].position;
      self.menuKey = null;
      self.hideMenu(position);
    }

    
    //删除节点数据
    delete self.nodes[key]
  }

  //开始画连线
  startDrawMoveLine(e,key) {
    var self = this;
    self.movingLine.fromKey = key;
    if (self.movingLine.line) {
      self.movingLine.line.remove();
    }
    self.movingLine.p1 = Object.assign({}, self.nodes[key].position);
    self.movingLine.p2 = {x:e.pageX-getLeft(self.box)-self.groupTranslate.x,y:e.pageY-getTop(self.box)-self.groupTranslate.y};
    self.movingLine.line = this.picture.append('path')
      .classed('.movingLine',true)
      .style('stroke','blue')
      .style('stroke-width',1)
      .style('pointer-events', 'none')
      .attr('d',self.lineMaker([self.movingLine.p1,self.movingLine.p2]));
  }
  drawMoveLine(e) {
    var self = this;
    self.movingLine.p2 = {x:e.pageX-getLeft(self.box)-self.groupTranslate.x,y:e.pageY-getTop(self.box)-self.groupTranslate.y};
    self.drawLine(self.movingLine.line,self.movingLine.p1,self.movingLine.p2);
  }
  drawLinkLine(fromKey,tagKey){
    var self = this;

    var from = self.nodes[fromKey];
    var target = self.nodes[tagKey];
    if(!target.data._upper){
      alert('只能连线到『上层规则节点』~');return;
    }

    if(self.testClosedLoop(fromKey,tagKey)){
      alert('这样连接就形成闭环啦!!!');
      return;
    }
    self.linesMap.set(fromKey,tagKey);

    if(self.movingLine.line){
      self.movingLine.line.remove();
      self.movingLine.line = null;
    }
    var line = this.pictureL.append('path')
      .classed('link-line',true)
      .classed(fromKey,true)
      .classed(tagKey,true)
      .attr('from',fromKey)
      .attr('target',tagKey)
      .style('stroke','blue')
      .style('cursor','pointer')
      .style('stroke-width',1)
      .attr('d',self.lineMaker([from.position,target.position]))
      .attr("marker-mid","url(#arrow)")
      .on('mouseover',function (d) {
        var $this = d3.select(this);
        $this.style('stroke','#13c0f1').style('stroke-width',2)

      })
      .on('mouseout',function () {
        var $this = d3.select(this);
        $this.style('stroke','blue').style('stroke-width',1);
      })
      .call(d3.drag().on("start", function (d) {
        var $this = d3.select(this);
        var dx=0;
        var dy=0;
        d3.event.on("drag", dragged).on("end", ended);
        function dragged() {
          var e = d3.event;
          dx += e.dx;
          dy += e.dy;
          $this.attr("transform",`translate(${dx},${dy})`);
        }
        function ended() {
          if( Math.sqrt(dx*dx+dy*dy)>80){
            self.delLinkLine(fromKey,tagKey)
          }else {
            $this.transition()
              .duration(300)
              .attr("transform",'translate(0,0)');
          }
        }
      }));
    self.linesEL[`${fromKey}-${tagKey}`] = line;
  }
  //删除连线
  delLinkLine(fromKey,tagKey){
    //删连线
    this.linesEL[`${fromKey}-${tagKey}`].remove();
    delete this.linesEL[`${fromKey}-${tagKey}`];
    //删节点关系
    this.linesMap.delTagsByFrom(fromKey);//基于起点删终点,数据结构决定这样只删一条.
  }

  //根据移动的节点,移动相关连线
  moveLinkLineByNode(nodeKey){
    var self = this;
    d3.selectAll(`path.link-line.${nodeKey}`)
      .attr('d',function () {
        var $this = d3.select(this);
        var fromP = self.nodes[$this.attr('from')].position;
        var targetP = self.nodes[$this.attr('target')].position;
        return self.lineMaker([fromP,targetP]);
      })
  }
  //判断节点是否已经有连向其它节点的连线
  hasLinkedTo(key){
    if(this.linesMap.getTagSByFrom(key)){
      return true;
    }
    return false;
  }
  //画线
  drawLine(line,p1,p2){
    line.attr('d',this.lineMaker([p1,p2]));
  }

  //测试连接是否形成闭环
  testClosedLoop(fromKey,tarKey){
    var self = this;
    var re;
    var nextKeys = self.linesMap.getTagSByFrom(tarKey);
    if(!nextKeys){
      re = false;
    }else if(fromKey == nextKeys[0]){//nextKeys只会有一个,因为我们节点连别的节点的时候只能连一个（好大的胆子~）
      re = true;
    }else {
      re = self.testClosedLoop(fromKey,nextKeys[0])
    }
    return re;
  }


  //生成数据结构
  generatorDataStruct(){
    var self = this;
    //1.判断是不是只有一个终极「规则节点」
    var endRuleKey = '';
    var endRuleCnt = 0;
    var noInputCnt = 0;
    var lonelyAtomCnt = 0;
    for (var key in self.nodes){
      var item = self.nodes[key];
      if(!self.linesMap.getTagSByFrom(key)){//这里表示没有去连别人
        if(item.data._upper){
          if(endRuleCnt<1){
            endRuleCnt++;
            endRuleKey = key;
          }else {
            alert('存在多个终极规则节点,无法生成数据结构');return false;
          }
        }else {
          lonelyAtomCnt++;
        }
      }

      if(item.data._upper){
        if(!self.linesMap.getFromsByTag(key)){//这里表示没有被别人连
          noInputCnt++;
        }
      }
    }
    if(lonelyAtomCnt){
      var cfm = confirm(`存在${lonelyAtomCnt}个孤立的原子节点,确定要生成结构体?`);
      if(!cfm){
        return false;
      }
    }
    if(noInputCnt){
      var cfm = confirm(`存在${noInputCnt}个没有激励的规则节点,确定要生成结构体?`);
      if(!cfm){
        return false;
      }
    }

    return self.realGeneratorDataStruct(endRuleKey);
  }

  realGeneratorDataStruct(rootKey){
    var self = this;
    var dataStruct = Object.assign({},self.nodes[rootKey].data);
    delete dataStruct._upper;
    var froms = self.linesMap.getFromsByTag(rootKey);
    if(froms){
      var subMents = [];
      froms.forEach(function (from) {
        subMents.push(self.realGeneratorDataStruct(from))
      });
      dataStruct.subMents = subMents;
    }
    return dataStruct;
  }


  //加载数据结构
  loadDataStruct(dataStruct,rootPosition,recursion){

    var self = this;
    if(!rootPosition){
      rootPosition = {
        x:self.box.offsetWidth/2,
        y:50
      };
    }
    var nodeData = Object.assign({},dataStruct);
    delete nodeData.subMents;
    if(dataStruct.subMents){
      nodeData._upper = true;
    }
    self.tplNodeCnt = (recursion)?self.tplNodeCnt:1;
    
    
    var key = 'n'+(new Date()).getTime() + self.tplNodeCnt;
    
    self.nodes[key] = {
      data: nodeData,
      position: {
        x: rootPosition.x,
        y: rootPosition.y
      }
    };
    self.drawNode(key);
    self.tplNodeCnt++;

    if(dataStruct.subMents){
      var cnt = dataStruct.subMents.length;
      var startX = rootPosition.x - self.opt.autoDistanceX*(cnt-1)/2;
      var Y = rootPosition.y + self.opt.autoDistanceY;
      for(var i in dataStruct.subMents){
        var p = {
          x:startX,
          y:Y
        };
        
        for(var k in self.nodes){
          var node = self.nodes[k];
          if(Math.abs(node.position.x - p.x) < (self.opt.autoDistanceX -10) && Math.abs(node.position.y - p.y) < 10){
            p.x = node.position.x + self.opt.autoDistanceX;
            startX = p.x;
          }
        }
        startX = startX + self.opt.autoDistanceX;

        var subItem = dataStruct.subMents[i];
        
        var fromKey = self.loadDataStruct(subItem,p,true);
        self.drawLinkLine(fromKey,key);
      }

    }

    return key;
  }




}


//获取元素的纵坐标 
function getTop(e){
  var offset=e.offsetTop;
  if(e.offsetParent!=null) offset+=getTop(e.offsetParent);
  return offset;
}
//获取元素的横坐标 
function getLeft(e){
  var offset=e.offsetLeft;
  if(e.offsetParent!=null) offset+=getLeft(e.offsetParent);
  return offset;
}

export default d3RiskRules