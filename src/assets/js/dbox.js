(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.dbox = global.dbox || {})));
}(this, (function (exports) { 'use strict';

var carto = function() {

  function carto(){

  }

  carto.query = function(config, callback){
    //Config the cartdb User
    var sql = new cartodb.SQL({ user: config.cartodb.user });
    //Execute the query
    sql.execute(config.cartodb.sql)
      .done(function(data){

        var result = data.rows;
        //parse the data
        if( config.parser ){
          result = data.rows.map(config.parser);
        }
        //execute the callback with no error
        callback(null, result);
      })
      .error(function(error){
        //Return the error
        callback(error, null);
      });
  };

  return carto;
};

var chart = function(config) {

  function Chart(config){
    var vm = this;
    vm._config = config ? _.cloneDeep(config) : {size: {}};
    vm._data = [];
    vm._margin = vm._config.size.margin ? vm._config.size.margin : {left: 0, right: 0, top: 0, bottom: 0};

    //Define width and height
    vm._width = vm._config.size.width ? vm._config.size.width - vm._margin.left - vm._margin.right : 800;
    vm._height = vm._config.size.height ? vm._config.size.height - vm._margin.top - vm._margin.bottom : 600;
    vm._svg = '';
    vm._scales ={};
    vm._axes = {};

    //Public
    vm.layers = [];

  }
  //------------------------
  //User
  Chart.prototype.config = function(config){
    var vm = this;
    vm._config = _.cloneDeep(config);
    return vm;
  };

  Chart.prototype.grid = function(bool) {
    var vm = this;
    vm._config.grid = bool ? true : false;
    return vm;
  };

  Chart.prototype.bindTo = function(selector) {
    var vm = this;
    vm._config.bindTo = selector;
    return vm;
  };

  Chart.prototype.data = function(data){
    var vm= this;
    vm._config.data = data;
    return vm;
  };

  Chart.prototype.layer = function(_layer, _config){
    var vm = this;
    var layer;
    var config = _config ? _config : vm._config;
    if( _layer === undefined && _layer === null){
      //@Todo Throw Error
    }else{
      layer = _layer(config);
      layer.chart(vm);
      vm.layers.push(layer);
      return layer;
    }
  };

  Chart.prototype.getLayer = function(layer){
    var vm = this;
    return vm.layers[layer];
  };

  Chart.prototype.draw =function(){
    var vm     = this, q;
    vm._scales = vm.scales();
    vm._axes   = vm.axes();



    q = vm.loadData();

    q.await(function(error,data){
      if (error) {
        throw error;
        return false;
      }
      vm._data = data;
      vm.drawSVG();
      if(vm._config.grid == true) {
        vm.drawGrid();
      }
      vm.drawGraphs();
      vm.drawAxes();

      //Trigger load chart event
      if( vm._config.events && vm._config.events.load){
        vm.dispatch.on("load.chart", vm._config.events.load(vm));
      }

    });

  };

  //----------------------
  //Helper functions
  Chart.prototype.scales = function(){
    var vm = this;

    var scales = {};

    //xAxis scale
    if(vm._config.xAxis && vm._config.xAxis.scale){
      switch(vm._config.xAxis.scale){
        case 'linear':
          scales.x = d3.scaleLinear()
              .range([0, vm._width]);
        break;

        case 'time':
          scales.x = d3.scaleTime()
              .range([0, vm._width]);
        break;

        case 'ordinal':
          scales.x = d3.scaleOrdinal()
            .rangeBands([0, vm._width], 0.1);
        break;

            case 'quantile':
              scales.x = d3.scaleOrdinal()
                .rangeBands([0, vm._width], 0.1);

              scales.q = d3.scaleQuantile()
                .range(d3.range(vm._config.xAxis.buckets) );
            break;

        default:
          scales.x = d3.scaleLinear()
              .range([0, vm._width]);
        break;
      }
    }else{
      scales.x = d3.scaleLinear()
          .range([0, vm._width]);
    }

    //yAxis scale
    if(vm._config.yAxis && vm._config.yAxis.scale){
      switch(vm._config.yAxis.scale){
        case 'linear':
          scales.y = d3.scaleLinear()
              .range([vm._height, 0]);
        break;

        case 'time':
          scales.y = d3.scaleTime()
              .range([vm._height, 0]);
        break;

        case 'ordinal':
          scales.y = d3.scaleOrdinal()
            .rangeBands([vm._height, 0], 0.1);
        break;

        case 'quantile':
          scales.y = d3.scaleOrdinal()
            .rangeBands([0, vm._width], 0.1);

          scales.q = d3.scaleQuantile()
            .range(d3.range(vm._config.yAxis.buckets) );
        break;

        default:
          scales.y = d3.scaleLinear()
              .range([vm._height, 0]);
        break;
      }
    }else{
      scales.y = d3.scaleLinear()
          .range([vm._height, 0]);
    }


    scales.color = d3.scaleOrdinal(d3.schemeCategory10);

    return scales;
  };

  Chart.prototype.axes = function(){
    var vm = this, axes={};

    axes.x = d3.axisBottom(vm._scales.x);
    axes.y = d3.axisLeft(vm._scales.y);

    if(vm._config.yAxis && vm._config.yAxis.ticks
        && vm._config.yAxis.ticks.enabled === true && vm._config.yAxis.ticks.style ){

      switch(vm._config.yAxis.ticks.style){
        case 'straightLine':
          axes.y
            .tickSize(-vm._width,0);
        break;
      }
    }

    if( vm._config.yAxis && vm._config.yAxis.ticks && vm._config.yAxis.ticks.format){
      axes.y.tickFormat(vm._config.yAxis.ticks.format);
    }
    return axes;
  };



  Chart.prototype.loadData = function(){
    var vm = this;

    if(vm._config.data.tsv){
      var q = d3.queue()
                .defer(d3.tsv, vm._config.data.tsv);
    }

    if(vm._config.data.json){
      var q = d3.queue()
                .defer(d3.json, vm._config.data.json);
    }

    if(vm._config.data.csv){
        var q = d3.queue()
                .defer(d3.csv, vm._config.data.csv);
    }

    if(vm._config.data.raw){
        var q = d3.queue()
                .defer(vm.mapData, vm._config.data.raw);
    }

    if(vm._config.data.cartodb){
      var q = d3.queue()
            .defer(carto.query,vm._config.data);
    }


    if(vm._config.plotOptions && vm._config.plotOptions.bars
      && vm._config.plotOptions.bars.averageLines && Array.isArray(vm._config.plotOptions.bars.averageLines)
      && vm._config.plotOptions.bars.averageLines.length >0 ){

      vm._config.plotOptions.bars.averageLines.forEach(function(l){
        if(l.data.cartodb){
          q.defer(carto.query, l.data);
        }
      });
    }


    return q;
  };

  Chart.prototype.drawSVG = function(){
    var vm = this;

    //Remove any previous svg
    d3.select(vm._config.bindTo).select('svg').remove();
    d3.select(vm._config.bindTo).html('');

    //Add the css template class
    if(vm._config.template){
      d3.select(vm._config.bindTo).classed(vm._config.template, true);
    }

    //Add title to the chart
    if(vm._config.chart && vm._config.chart.title){
      d3.select(vm._config.bindTo).append("div")
        .attr("class", "chart-title")
        .html(vm._config.chart.title);
    }

    //Add Legend to the chart
    //@TODO - PASS THE STYLES TO DBOX.CSS
    //@TODO - ALLOW DIFFERENT POSSITIONS FOR THE LEGEND
    if(vm._config.legend && vm._config.legend.enable === true && vm._config.legend.position === 'top'){
      var legend = d3.select(vm._config.bindTo).append("div")
        .attr("class", "chart-legend-top");

      var html = '';
      html+="<div style='background-color:#E2E2E1;text-align:center;height: 40px;margin: 0px 15px'>";
      vm._config.legend.categories.forEach(function(c){
        html+="<div class='dbox-legend-category-title' style='margin:0 20px;'><span class='dbox-legend-category-color' style='background-color:"+c.color+";'> </span><span style='height: 10px;float: left;margin: 10px 5px 5px 5px;border-radius: 50%;'>"+c.title+"</span></div>";
      });
      html+="</div>";
      legend.html(html);
    }


    //Create the svg
    vm._svg = d3.select(vm._config.bindTo).append("svg")
      .attr("width", vm._width + vm._margin.left + vm._margin.right)
      .attr("height", vm._height + vm._margin.top + vm._margin.bottom)
      .append("g")
      .attr("transform", "translate(" + vm._margin.left + "," + vm._margin.top + ")");

    //Call the tip function
    /*if(vm._config.data.tip){
      vm._svg.call(vm._tip);
    }*/

    //Apply background color
    if(vm._config.chart && vm._config.chart.background && vm._config.chart.background.color){
      d3.select(vm._config.bindTo+" svg").style('background-color', vm._config.chart.background.color );
    }

    var legendBottom = d3.select(vm._config.bindTo).append("div")
        .attr("class", "chart-legend-bottom");
    //Legend for average lines
    /*
    if(vm._config.plotOptions && vm._config.plotOptions.bars
      && vm._config.plotOptions.bars.averageLines && Array.isArray(vm._config.plotOptions.bars.averageLines)
      && vm._config.plotOptions.bars.averageLines.length >0 ){

      d3.select(vm._config.bindTo).append("div")
        .attr("class", "container-average-lines")
        .append('div')
          .attr("class", "legend-average-lines")
        .html('Average Lines Controller')
    }
    */

  };

  Chart.prototype.drawGrid = function() {
    var vm = this;
    console.log(vm.layers[0]._scales);
    return vm;
  };

  Chart.prototype.drawAxes = function(){
    var vm = this;
    var xAxis, yAxis;

    if(!vm._config.xAxis || ( vm._config.xAxis && vm._config.xAxis.enabled !== false ) ){
      xAxis = vm._svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + vm._height + ")")
        .call(vm._axes.x);
    }

    if(!vm._config.yAxis || ( vm._config.yAxis && vm._config.yAxis.enabled !== false ) ){
      yAxis = vm._svg.append("g")
        .attr("class", "y axis")
        .call(vm._axes.y);
    }

    /*xAxis.selectAll('text')
        .on("click",function(d,i){
          vm._config.xAxis.onclick.call(this, d, i);
        });*/


    if(vm._config.xAxis && vm._config.xAxis.text){
      xAxis.append("text")
        .attr("class", "label title")
        .attr("x", vm._chart._width/2)
        .attr("y", 30)
        .style("text-anchor", "middle")
        .text(vm._config.xAxis.text);
    }

    if(vm._config.xAxis && vm._config.xAxis.dropdown && vm._config.xAxis.dropdown.enable === true){
      var xAxisDropDown = d3.select(vm._config.bindTo).append("div").attr('class','dbox-xAxis-select')
                            .append("select")
                            .on("change", function(){
                              vm.updateAxis('x', this.value);
                            });

      xAxisDropDown.selectAll("option")
        .data(vm._config.xAxis.dropdown.options)
        .enter().append("option")
        .attr("value", function (d) { return d.value; })
        .text(function (d) { return d.title; })
        .property("selected", function(d){ return d.selected  });

    }

    if(vm._config.yAxis && vm._config.yAxis.enabled !== false){

      if(vm._config.yAxis && vm._config.yAxis.text){
        yAxis.append("text")
          .attr("class", "label title")
          .attr("transform", "rotate(-90)")
          .attr("y", -30)
          .attr("x", -150)
          .attr("dy", ".71em")
          .style("text-anchor", "end")
          .text(vm._config.yAxis.text);
      }
    }

    if(vm._config.yAxis && vm._config.yAxis.dropdown && vm._config.yAxis.dropdown.enable === true){
      var yAxisDropDown = d3.select(vm._config.bindTo).append("div").attr('class','dbox-yAxis-select')
                            .attr('style', function(){
                              var x = -1*d3.select(vm._config.bindTo).node().getBoundingClientRect().width/2+ vm._chart._margin.left/4;
                              var y = -1*d3.select(vm._config.bindTo).node().getBoundingClientRect().height/2;
                              return 'transform: translate('+x+'px,'+y+'px) rotate(-90deg);'
                            })
                            .append("select")
                            .on("change", function(){
                              vm.updateAxis('y', this.value);
                            });

      yAxisDropDown.selectAll("option")
        .data(vm._config.yAxis.dropdown.options)
        .enter().append("option")
        .attr("value", function (d) { return d.value; })
        .text(function (d) { return d.title; })
        .property("selected", function(d){ return d.selected  });

    }

  };

  Chart.prototype.drawGraphs = function(){
    var vm = this;

    vm.layers.forEach(function(gr){
      gr.data(vm._data)
        .scales(vm._scales)
        .axes(vm._axes)
        .domains()
        .draw();

      //@TODO validate domains from multiple layers
      vm._scales = gr._scales;
    });
  };

  Chart.prototype.dispatch = d3.dispatch("load", "change");

  Chart.prototype.mapData  =  function (data, callback){
    callback(null, data);
  };

  Chart.prototype.getDomains = function(data){
    var vm = this;

    var domains = {};
    var minMax = [];
      var sorted = '';


      //Default ascending function
      var sortFunctionY = function(a, b) { return d3.ascending(a.y,b.y); };
      var sortFunctionX = function(a, b) { return d3.ascending(a.x,b.x); };


      //if applying sort
      if(vm._config.data.sort && vm._config.data.sort.order){
        switch(vm._config.data.sort.order){
          case 'asc':
            sortFunctionY = function(a, b) { return d3.ascending(a.y,b.y); };
            sortFunctionX = function(a, b) { return d3.ascending(a.x,b.x); };
          break;

          case 'desc':
            sortFunctionY = function(a, b) { return d3.descending(a.y,b.y); };
            sortFunctionX = function(a, b) { return d3.descending(a.x,b.x); };
          break;
        }
      }


    //xAxis
    if(vm._config.xAxis && vm._config.xAxis.scale){
      switch(vm._config.xAxis.scale){
        case 'linear':
          minMax = d3.extent(data, function(d) { return d.x; });
          domains.x = minMax;
        break;

        case 'time':
              minMax = d3.extent(data, function(d) { return d.x; });
              domains.x = minMax;
        break;

        case 'ordinal':

              //If the xAxis' order depends on the yAxis values
              if(vm._config.data.sort && vm._config.data.sort.axis === 'y'){
                sorted = data.sort(sortFunctionY);
              }else {
                sorted = data.sort(sortFunctionX);
              }

              domains.x = [];
              sorted.forEach(function(d){
                domains.x.push(d.x);
              });

        break;

            case 'quantile':

              //The xAxis order depends on the yAxis values
              if(vm._config.data.sort && vm._config.data.sort.axis === 'y'){
                sorted = data.sort(sortFunctionY);
              }else {
                sorted = data.sort(sortFunctionX);
              }

              domains.q = [];
              sorted.forEach(function(d){
                domains.q.push(d.x);
              });

              domains.x = d3.range(vm._config.xAxis.buckets);

            break;


        default:
          minMax = d3.extent(data, function(d) { return d.x; });
          domains.x = minMax;
        break;
      }
    }else{
      minMax = d3.extent(data, function(d) { return d.x; });
      domains.x = minMax;
    }

    //yAxis
    if(vm._config.yAxis && vm._config.yAxis.scale){
      switch(vm._config.yAxis.scale){
        case 'linear':
          minMax = d3.extent(data, function(d) { return d.y; });

          //Adjust for min values greater than zero
          //set the min value to -10%
          if(minMax[0] > 0 ){
            minMax[0] = minMax[0] - (minMax[1]- minMax[0])*.1;
          }
          domains.y = minMax;
        break;

        case 'time':
          minMax = d3.extent(data, function(d) { return d.y; });
                domains.y = minMax;
        break;

        case 'ordinal':
              if(vm._config.data.sort && vm._config.data.sort.axis === 'y'){

                var sorted = data.sort(function(a, b) { return d3.ascending(a.y,b.y); });
                domains.y = [];
                sorted.forEach(function(d){
                  domains.y.push(d.x);
                });

              }else{
                domains.y = d3.map(data, function(d) {
                  return d.y;
                }).keys().sort(function(a, b) { return d3.ascending(a,b); });
              }

        break;

        default:
          minMax = d3.extent(data, function(d) { return d.y; });
          domains.y = minMax;
        break;
      }
    }else{
      minMax = d3.extent(data, function(d) { return d.y; });
      domains.y = minMax;
    }


    return domains;
  };

  Chart.prototype.destroy = function(){
    var vm = this;
    d3.select(vm._config.bindTo).html("");
  };

  return new Chart(config);
};

var scatter = function(config) {

  function Scatter(config){
    var vm = this;
    vm._config = config ? config : {};
    vm._data = [];
    vm._scales ={};
    vm._axes = {};
    //vm._tip = d3.tip().attr('class', 'd3-tip').html(vm._config.data.tip);
  }

  //-------------------------------
  //User config functions
  Scatter.prototype.x = function(col){
    var vm = this;
    vm._config.x = col;
    return vm;
  };

  Scatter.prototype.y = function(col){
    var vm = this;
    vm._config.y = col;
    return vm;
  };

  Scatter.prototype.color = function(col){
    var vm = this;
    vm._config.color = col;
    return vm;
  };

  Scatter.prototype.end = function(){
    var vm = this;
    return vm._chart;
  };

  //-------------------------------
  //Triggered by the chart.js;
  Scatter.prototype.chart = function(chart){
    var vm = this;
    vm._chart = chart;
    return vm;
  };

  Scatter.prototype.data = function(data){
    var vm = this;
    vm._data = data.map(function(d){
      var m = {};
      m.x = +d[vm._config.x];
      m.y = +d[vm._config.y];
      m.color = d[vm._config.color];
      return m;
    });
    return vm;
  };

  Scatter.prototype.scales = function(s){
    var vm = this;
    vm._scales = s;
    return vm;
  };

  Scatter.prototype.axes = function(a){
    var vm = this;
    vm._axes = a;
    return vm;
  };

  Scatter.prototype.domains = function(){
    var vm = this;
    var xMinMax = d3.extent(vm._data, function(d) { return d.x; }),
        yMinMax=d3.extent(vm._data, function(d) { return d.y; });
    var arrOk = [0,0];

    if(vm._config.fixTo45){
      if(xMinMax[1] > yMinMax[1]){
        arrOk[1] = xMinMax[1];
      }else{
        arrOk[1] = yMinMax[1];
      }

      if(xMinMax[0] < yMinMax[0]){
        //yMinMax = xMinMax;
        arrOk[0] = xMinMax[0];
      }else{
        arrOk[0] = yMinMax[0];
      }

      vm._scales.x.domain(arrOk).nice();
      vm._scales.y.domain(arrOk).nice();

    }else{
      vm._scales.x.domain(xMinMax).nice();
      vm._scales.y.domain(yMinMax).nice();
    }

    return vm;
  };

  Scatter.prototype.draw = function(){
    var vm = this;

    console.log(vm, vm._scales, vm._scales.y(6.3));

    var circles = vm._chart._svg.selectAll(".dot")
        .data(vm._data)
        //.data(vm._data, function(d){ return d.key})
      .enter().append("circle")
        .attr("class", "dot")
        .attr("r", 5)
        .attr("cx", function(d) { return vm._scales.x(d.x); })
        .attr("cy", function(d) { console.log(d, vm._scales, vm._scales.y(d.y) ); return vm._scales.y(d.y); })
        .style("fill", function(d) { return vm._scales.color(d.color); })
        .on('mouseover', function(d,i){
          if(vm._config.mouseover){
            vm._config.mouseover.call(vm, d,i);
          }
          //vm._chart._tip.show(d, d3.select(this).node());
        })
        .on('mouseout', function(d,i){
          if(vm._config.mouseout){
            vm._config.mouseout.call(this, d,i);
          }
          //vm._chart._tip.hide();
        })
        .on("click", function(d,i){
          if(vm._config.onclick){
            vm._config.onclick.call(this, d, i);
          }
        });

    return vm;
  };

  return new Scatter(config);
};

var timeline = function(config) {

  var parseDate = d3.timeParse("%Y-%m-%d");

  function Timeline(config){
    var vm = this;
    vm._config = config ? config : {};
    vm._data = [];
    vm._scales ={};
    vm._axes = {};

    vm._line = d3.line()
      .curve(d3.curveBasis)
      .x(function(d) { return vm._scales.x(d.x); })
      .y(function(d) { return vm._scales.y(d.y); });


    vm._area = d3.area()
      .curve(d3.curveBasis)
      .x(function(d) {
        if (d.alreadyScaled && d.alreadyScaled === true){
          return d.x;
        }else{
          return vm._scales.x(d.x);
        }
      })
      .y1(function(d) {
        if (d.alreadyScaled && d.alreadyScaled === true){
          return d.y;
        }else{
          return vm._scales.y(d.y);
        }

      });

  }

  //-------------------------------
  //User config functions
  Timeline.prototype.x = function(col){
    var vm = this;
    vm._config.x = col;
    return vm;
  };

  Timeline.prototype.y = function(col){
    var vm = this;
    vm._config.y = col;
    return vm;
  };

  Timeline.prototype.series = function(arr){
    var vm = this;
    vm._config.series = arr;
    return vm;
  };

  Timeline.prototype.color = function(col){
    var vm = this;
    vm._config.color = col;
    return vm;
  };

  Timeline.prototype.end = function(){
    var vm = this;
    return vm._chart;
  };

  //-------------------------------
  //Triggered by the chart.js;
  Timeline.prototype.chart = function(chart){
    var vm = this;
    vm._chart = chart;
    return vm;
  };


  Timeline.prototype.data = function(data){
    var vm = this;

    vm._data = data.map(function(d){
      d.x = parseDate(d[vm._config.x]);
      d.color = d[vm._config.color];
      delete(d[vm._config.x]);
      return d;
    });

    vm._lines = vm._config.y ? vm._config.y : vm._config.series;

    vm._lines = vm._lines.map(function(name) {
      return {
        name: name,
        values: data.map(function(d) {
          return {x: d.x, y: +d[name]};
        })
      };
    });

    return vm;
  };

  Timeline.prototype.scales = function(s){
    var vm = this;
    vm._scales = s;
    return vm;
  };

  Timeline.prototype.axes = function(a){
    var vm = this;
    vm._axes = a;
    return vm;
  };

  Timeline.prototype.domains = function(){
    var vm = this;
    vm._xMinMax = d3.extent(vm._data, function(d) { return d.x; });

    vm._yMinMax = [
      d3.min(vm._lines, function(c) { return d3.min(c.values, function(v) { return v.y; }); }),
      d3.max(vm._lines, function(c) { return d3.max(c.values, function(v) { return v.y; }); })
    ];

    vm._scales.x.domain(vm._xMinMax);
    vm._scales.y.domain(vm._yMinMax);

    console.log(vm._scales.x.domain(), vm._chart._scales.x.domain());

    vm._chart._scales = vm._scales;

    return vm;
  };

  Timeline.prototype.draw = function(){
    var vm = this;

    var lines = vm._chart._svg.selectAll(".lines")
      .data(vm._lines)
    .enter().append("g")
      .attr("class", "lines");

    var path = vm._chart._svg.selectAll(".lines").append("path")
      .attr("class", "line")
      .attr("d", function(d) {
        return vm._line(d.values);
      })
      .style("stroke", function(d){
        if (d.name == "Airbus"){
          return "rgb(000,255,000)";
        }else {
          return "#000";
        }
      });


    var t = textures.lines().thicker();

    vm._chart._svg.call(t);


    vm._area.y0(vm._scales.y(vm._yMinMax[0]));

    var areas = vm._chart._svg.selectAll(".areas")
      .data(vm._lines)
    .enter().append("g")
      .attr("class", "areas");

    var pathArea  = vm._chart._svg.selectAll(".areas").append("path")
      .attr("class", "area")
      .attr("d", function(d) {
        return vm._area(d.values);
      })
      .attr("fill", t.url());

    /*path.each(function(d) { d.totalLength = this.getTotalLength(); })
      .attr("stroke-dasharray", function(d) { return d.totalLength + " " + d.totalLength; })
      .attr("stroke-dashoffset", function(d) { return d.totalLength; })
      .transition()
        .duration(5000)
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0);*/

    return vm;
  };

  return new Timeline(config);
};


/*import chart from './chart.js';

function Timeline(config) {
  var vm = this;
  vm._config = config;
  vm._chart;
  vm._scales = {};
  vm._axes = {};
}

Timeline.prototype = timeline.prototype = {
	generate:function(){
		var vm = this, q;

		vm.draw();
    vm.setScales();
		vm.setAxes();

		q = vm._chart.loadData();

    q.await(function(error,data){
      if (error) {
        //console.log(error)
        throw error;
        return false;
      }

      vm.setData(data);
      vm.setDomains();
      vm.drawAxes();
      console.log("generate", vm._data);
      vm.drawData();
    })

	},
	draw : function(){
		var vm = this
		vm._chart = chart(vm._config);
	},
	setScales: function(){
		var vm = this;

		vm._scales.x = d3.scaleTime()
		  .range([0, vm._chart._width]);

		vm._scales.y = d3.scaleLinear()
		  .range([vm._chart._height, 0]);

    vm._scales.color = d3.scaleOrdinal(d3.schemeCategory20c);
	},
	setAxes : function(){
		var vm = this;

		vm._axes.x = d3.svg.axis()
		  .scale(vm._scales.x)
		  .orient("bottom");

		vm._axes.y = d3.svg.axis()
		  .scale(vm._scales.y)
		  .orient("left");


    if(vm._config.yAxis && vm._config.yAxis.ticks
        && vm._config.yAxis.ticks.enabled === true && vm._config.yAxis.ticks.style ){

      switch(vm._config.yAxis.ticks.style){
        case 'straightLine':
          vm._axes.y
            .tickSize(-vm._chart._width,0);
        break;
      }

    }

    if( vm._config.yAxis.ticks.format){
      console.log('Set tick format');
      vm._axes.y.tickFormat(vm._config.yAxis.ticks.format);
    }
	},
	setData:function(data){
    var vm = this;
    var keys = d3.keys(data[0]).filter(function(key) { return key !== "date"; });

    var series = keys.map(function(name) {
      return {
        name: name,
        values: data.map(function(d) {
          return {x: d.date, y: +d[name]};
        })
      };
    });

    vm._data = series;
  },
  setDomains:function(){
    var vm = this;

    vm._scales.color.domain(vm._data.map(function(serie){
      return serie.name;
    }));

    vm._scales.x.domain([
      d3.min(vm._data, function(c) { return d3.min(c.values, function(v) { return v.x; }); }),
      d3.max(vm._data, function(c) { return d3.max(c.values, function(v) { return v.x; }); })
    ]);

    vm._scales.y.domain([
      d3.min(vm._data, function(c) { return d3.min(c.values, function(v) { return v.y; }); }),
      d3.max(vm._data, function(c) { return d3.max(c.values, function(v) { return v.y; }); })
    ]);
  },
  drawAxes:function(){
    var vm = this;

    vm._chart._svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + vm._chart._height + ")")
        .call(vm._axes.x)
      .append("text")
        .attr("class", "label")
        .attr("x", vm._chart._width)
        .attr("y", -6)
        .style("text-anchor", "end")
        .text("");

    var yAxis = vm._chart._svg.append("g")
        .attr("class", "y axis")
        .call(vm._axes.y)


    if(vm._config.yAxis && vm._config.yAxis.text){
      yAxis.append("text")
        .attr("class", "label")
        .attr("transform", "rotate(-90)")
        .attr("x", -vm._chart._height/2)
        .attr("y", -vm._config.size.margin.left + 10)
        .attr("dy", ".71em")
        .style("text-anchor", "middle")
        .style("font-size","14px")
        .text(vm._config.yAxis.text);
    }

  },
  drawData : function(){
    var vm = this;
    var line = d3.svg.line()
        .interpolate(vm._config.data.interpolation)
        .defined(function(d) { return d; })
        .x(function(d) { return vm._scales.x(d.x); })
        .y(function(d) { return vm._scales.y(d.y); });

    var series = vm._chart._svg.selectAll(".series")
        .data(vm._data)
      .enter().append("g")
        .attr("class", "series")

    series.append("path")
        .attr("class", "line")
        .attr("d", function(d) { return line(d.values); })
        .style("stroke-dasharray",function(d){ if(d.name == "Nacional"){
            return ("10,5");
          }})
        .style("stroke", function(d) {
          if(d.color){ return d.color; }
          else { return vm._scales.color(d.key); }
        }) //return vm._scales.color(d.name); })
        .style("stroke-width", 3);


    series.selectAll('.dot')
        .data(function(d){return d.values})
      .enter().append("circle")
        .attr("class", "dot")
        .attr("r", 3)
        .attr("cx", function(d) { return vm._scales.x(d.x); })
        .attr("cy", function(d) { return vm._scales.y(d.y); })
        .style("fill", function(d) {
          if(d.color){ return d.color; }
          else { return vm._scales.color(d.key); }
        })//return vm._scales.color(d.name); })
        .style("stroke", function(d) {
          if(d.color){ return d.color; }
          else { return vm._scales.color(d.key); }
        }) // return vm._scales.color(d.name); })
        .on('mouseover', function(d,i){
          if(vm._config.data.mouseover){
            vm._config.data.mouseover.call(vm, d,i)
          }
          vm._chart._tip.show(d, d3.select(this).node())
        })
        .on('mouseout',function(d,i){
          if(vm._config.data.mouseout){
            vm._config.data.mouseout.call(vm, d,i)
          }
          vm._chart._tip.hide(d, d3.select(this).node())
        });

        //series.selectAll('.dot-inside')
        //  .data(function(d){return d.values})
        //.enter().append("circle")
        //  .attr("class", "dot-inside")
        //  .attr("r", 4)
        //  .attr("cx", function(d) { return vm._scales.x(d.x); })
        //  .attr("cy", function(d) { return vm._scales.y(d.y); })
        //  .style("fill", 'black')//return vm._scales.color(d.name); })
        //  .style("stroke", function(d) { return d.color;}) // return vm._scales.color(d.name); })
        //  .on('mouseover', function(d,i){
        //    if(vm._config.data.mouseover){
        //      vm._config.data.mouseover.call(vm, d,i)
        //    }
        //    vm._chart._tip.show(d, d3.select(this).node())
        //  })
        //  .on('mouseout',function(d,i){
        //    if(vm._config.data.mouseout){
        //      vm._config.data.mouseout.call(vm, d,i)
        //    }
        //    vm._chart._tip.hide(d, d3.select(this).node())
        //  });


    //series.append("text")
    //    .datum(function(d) { return {name: d.name, value: d.values[d.values.length - 1]}; })
    //    .attr("transform", function(d) { return "translate(" + vm._scales.x(d.value.x) + "," + vm._scales.y(d.value.y) + ")"; })
    //    .attr("x", 3)
    //    .attr("dy", ".35em")
    //    .text(function(d) { return d.name; });
  }


}

export default function timeline(config) {
  return new Timeline(arguments.length ? config : null);
}*/

var heatmap = function(config) {

  function Heatmap(config){
    var vm = this;
    vm._config = config ? config : {};
    vm._data = [];
    vm._scales ={};
    vm._axes = {};
    vm._gridSize = Math.floor(vm._config.size.width / 16);
    vm._legendElementWidth = vm._gridSize;

    vm._config._format     = d3.format(",.1f");

    vm._tip = d3.tip().attr('class', 'd3-tip');
  }

  //-------------------------------
  //User config functions
  Heatmap.prototype.x = function(columns){
    var vm = this;
    vm._config.x = columns;
    return vm;
  };

  Heatmap.prototype.y = function(columns){
    var vm = this;
    vm._config.y = columns;
    return vm;
  };

  Heatmap.prototype.colors = function(colors){
    var vm = this;
    vm._config.colors = colors;
    return vm;
  };

  Heatmap.prototype.tip = function(tip){
    var vm = this;
    vm._config.tip = tip;
    vm._tip.html(vm._config.tip);
    return vm;
  };

  Heatmap.prototype.buckets = function(b){
    var vm = this;
    vm._config.buckets = buckets;
    return vm;
  };

  Heatmap.prototype.end = function(){
    var vm = this;
    return vm._chart;
  };

  //-------------------------------
  //Triggered by the chart.js;
  Heatmap.prototype.chart = function(chart){
    var vm = this;
    vm._chart = chart;
    return vm;
  };

  Heatmap.prototype.data = function(data){
    var vm = this;
    vm._data = data.map(function(d){
      var m = {
        y: d.edad_mujer,
        x: d.edad_hombre,
        value: +d.tot,
        percentage : +d.por,
      };
      return m;
    });
    return vm;
  };

  Heatmap.prototype.scales = function(s){
    var vm = this;
    vm._scales = s;
    return vm;
  };

  Heatmap.prototype.axes = function(a){
    var vm = this;
    vm._axes = a;
    return vm;
  };

  Heatmap.prototype.domains = function(){
    var vm = this;
    return vm;
  };

  Heatmap.prototype.draw = function(){
    var vm = this;

    //Call the tip
    vm._chart._svg.call(vm._tip);

    if(vm._config.xAxis){
      vm._config.xAxis.y =  vm._config.y.length * vm._gridSize+25;
    }else{
      vm._config.xAxis = { 'y' : vm._config.y.length * vm._gridSize };
    }

    vm._dayLabels = vm._chart._svg.selectAll(".dayLabel")
          .data(vm._config.y)
          .enter().append("text")
            .text(function (d) { return d; })
            .attr("x", 0)
            .attr("y", function (d, i) { return i * vm._gridSize; })
            .style("text-anchor", "end")
            .attr("transform", "translate(-6," + vm._gridSize / 1.5 + ")")
            .attr("class", "dayLabel mono axis");
            //.attr("class", function (d, i) { return ((i >= 0 && i <= 4) ? "dayLabel mono axis axis-workweek" : "dayLabel mono axis"); });

    vm._timeLabels = vm._chart._svg.selectAll(".timeLabel")
        .data(vm._config.x)
        .enter().append("text")
          .text(function(d) { return d; })
          .attr("x", function(d, i) { return i * vm._gridSize; })
          .attr("y", vm._config.xAxis.y)
          .style("text-anchor", "middle")
          .attr("transform", "translate(" + vm._gridSize / 2 + ", -6)")
          .attr("class", "timeLabel mono axis");
          //.attr("class", function(d, i) { return ((i >= 7 && i <= 16) ? "timeLabel mono axis axis-worktime" : "timeLabel mono axis"); });


    var colorScale = d3.scaleQuantile()
        .domain([0, d3.max(vm._data, function (d) { return d.value; })])
        .range(vm._config.colors);

    var cards = vm._chart._svg.selectAll(".hour")
        .data(vm._data, function(d) {
          return d.y+':'+d.x;
        });

    cards.enter().append("rect")
        .attr("x", function(d) { return (vm._config.x.indexOf(d.x) ) * vm._gridSize; })
        .attr("y", function(d) { return (vm._config.y.indexOf(d.y)) * vm._gridSize; })
        .attr("rx", 4)
        .attr("ry", 4)
        .attr("class", "hour bordered")
        .attr("width", vm._gridSize)
        .attr("height", vm._gridSize)
        .on('mouseover', function(d,i){
          /*if(vm._config.data.mouseover){
            vm._config.data.mouseover.call(vm, d,i);
          }*/
          vm._tip.show(d, d3.select(this).node());
        })
        .on('mouseout', function(d,i){
          /*if(vm._config.data.mouseout){
            vm._config.data.mouseout.call(this, d,i);
          }*/
          vm._tip.hide(d, d3.select(this).node());
        })
        .on("click", function(d,i){
          if(vm._config.data.onclick){
            vm._config.data.onclick.call(this, d, i);
          }
        })
        .style("fill", vm._config.colors[0])
      .transition()
        .duration(3000)
        .ease(d3.easeLinear)
        .style("fill", function(d) { return colorScale(d.value); });



    var legend = vm._chart._svg.selectAll(".legend")
        .data([0].concat(colorScale.quantiles()), function(d) { return d; });

    var lgroup = legend.enter().append("g")
        .attr("class", "legend");

    lgroup.append("rect")
        .attr("x", function(d, i) {  return vm._legendElementWidth * i; })
        .attr("y", vm._config.size.height - vm._config.size.margin.bottom*2)
        .attr("width", vm._legendElementWidth)
        .attr("height", vm._gridSize / 2)
        .style("fill", function(d, i) { return vm._config.colors[i]; });

    lgroup.append("text")
        .attr("class", "mono")
        .text(function(d) { return "≥ " + Math.round(d); })
        .attr("x", function(d, i) { return vm._legendElementWidth * i; })
        .attr("y", vm._config.size.height - vm._config.size.margin.bottom*2 + vm._gridSize);

    legend.exit().remove();
    return vm;
  };

  return new Heatmap(config);
};

var treemap = function(config) {
  function Treemap(config) {
    var vm = this;
    vm._config = config ? config : {};
    vm._config._padding    = 3;
    vm._config._colorScale = d3.scaleOrdinal(d3.schemeCategory20c);
    vm._config._format     = d3.format(",.1f");
    vm._config._labels     = true;
    vm._data   = [];
    vm._scales = {};
    vm._axes   = {};
  }

  //-------------------------------
  //User config functions
  Treemap.prototype.end = function(){
    var vm = this;
    return vm._chart;
  };

  Treemap.prototype.size = function(col){
    var vm = this;
    vm._config._size = col;
    return vm;
  };

  Treemap.prototype.colorScale = function(arrayOfColors){
    var vm = this;
    vm._config._colorScale = d3.scaleOrdinal(arrayOfColors);
    return vm;
  };

  Treemap.prototype.padding = function(padding){
    var vm = this;
    vm._config._padding = padding;
    return vm;
  };

  Treemap.prototype.nestBy = function(keys) {
    var vm = this;
    if(Array.isArray(keys)) {
      if(keys.length == 0)
        throw "Error: nestBy() array is empty";
      vm._config._keys = keys;
    } else if(typeof keys === 'string' || keys instanceof String) {
      vm._config._keys = [keys];
    } else {
      if(keys == undefined || keys == null)
        throw "Error: nestBy() expects column names to deaggregate data";
      vm._config._keys = [keys.toString()];
      console.warning("nestBy() expected name of columns. Argument will be forced to string version .toString()");
    }
    vm._config._labelName = vm._config._keys[vm._config._keys.length - 1]; //label will be last key
    return vm;
  };

  Treemap.prototype.format = function(format){
    var vm = this;
    if (typeof format == 'function' || format instanceof Function)
      vm._config._format = format;
    else
      vm._config._format = d3.format(format);
    return vm;
  };

  Treemap.prototype.labels = function(bool) {
    var vm = this;
    vm._config._labels = Boolean(bool);
    return vm;
  };

  //-------------------------------
  //Triggered by the chart.js;
  Treemap.prototype.chart = function(chart){
    var vm = this;
    vm._chart = chart;
    return vm;
  };

  Treemap.prototype.scales = function(scales){
    var vm = this;
    return vm;
  };

  Treemap.prototype.axes = function(axes){
    var vm = this;
    return vm;
  };

  Treemap.prototype.domains = function(){
    var vm = this;
    return vm;
  };

  Treemap.prototype.isValidStructure = function(datum){
    var vm = this;
    if((typeof datum.name === 'string' || datum.name instanceof String) && Array.isArray(datum.children)) {
      var res = true;
      datum.children.forEach(function(child) {
        res = res && vm.isValidStructure(child);
      });
      return res;
    } else if((typeof datum.name === 'string' || datum.name instanceof String) && Number(datum[vm._config._size]) == datum[vm._config._size]) {
      return true;
    } else {
      return false;
    }
  };

  Treemap.prototype.formatNestedData = function(data) {
    var vm = this;
    if(data.key) {
      data.name = data.key;
      delete data.key;
    } else {
      if(!Array.isArray(data.values)) {
        data.name = data[vm._config._labelName];
      }
    }
    if(Array.isArray(data.values)) {
      var children = [];
      data.values.forEach(function(v){
        children.push(vm.formatNestedData(v));
      });
      data.children = children;
      delete data.values;
    }
    if(!data[vm._config._size] && data.value){
      data[vm._config._size] = data.value;
    }
    return data;
  };

  Treemap.prototype.data = function(data){
    var vm = this;
    // Validate structure like [{name: '', children: [{},{}]}]
    if(data){
      if(Array.isArray(data) && data.length > 0) {
        if(!vm.isValidStructure(data[0])) {
          data.forEach(function(d){
            d[vm._config._size] = +d[vm._config._size];
          });
          try {
            if(!vm._config._keys)
              throw "nestBy() in layer was not configured";
            var nested = 'd3.nest()';
            for (var i = 0; i < vm._config._keys.length; i++) {
              nested += '.key(function(d){ return d.'+ vm._config._keys[i] + '; })';
            }
            nested += '.rollup(function(leaves) { return d3.sum(leaves, function(d) {return d.' + vm._config._size + ';})})';
            nested += '.entries(data)';

            var nestedData = eval(nested);
            // TODO: improve way to get nested multiple keys
            var aux = {};
            aux.key = 'data';
            aux.values = _.cloneDeep(nestedData); // WARN: Lodash dependency
            data = vm.formatNestedData(aux);
          } catch(err){
            console.error(err);
          }
        }
      } else {
        if(!vm.isValidStructure(data)) {
          try {
            if(!data.key)
              throw "Property 'key' not found";
            if(data[vm._config._size] !== Number(data[vm._config._size]))
              throw  "Value used for treemap rect size is not a number";
            data = vm.formatNestedData(data);
          } catch(err){
            console.error(err);
          }
        }
      }
    }
    vm._data = data;
    return vm;
  };

  Treemap.prototype.draw = function(){
    var vm = this;

    var treemap = d3.treemap()
        .tile(d3.treemapResquarify)
        .size([vm._chart._width, vm._chart._height])
        .round(true)
        .paddingInner(vm._config._padding);

    var root = d3.hierarchy(vm._data)
        .eachBefore(function(d) { d.data.id = (d.parent ? d.parent.data.id + "." : "") + d.data.name; })
        .sum(function(d){return d[vm._config._size];})
        .sort(function(a, b) { return b.height - a.height || b.value - a.value; });

    treemap(root);

    var cell = vm._chart._svg.selectAll("g")
      .data(root.leaves())
      .enter().append("g")
        .attr("transform", function(d) { return "translate(" + d.x0 + "," + d.y0 + ")"; });

    cell.append("rect")
        .attr("id", function(d) { return d.data.id; })
        .attr("width", function(d) { return d.x1 - d.x0; })
        .attr("height", function(d) { return d.y1 - d.y0; })
        .attr("fill", function(d) { return vm._config._colorScale(d.data.id); });

    cell.append("clipPath")
        .attr("id", function(d) { return "clip-" + d.data.id; })
      .append("use")
        .attr("xlink:href", function(d) { return "#" + d.data.id; });

    if(vm._config._labels) {
      var text = cell.append("text")
          .attr("clip-path", function(d) { return "url(#clip-" + d.data.id + ")"; });
      text.append("tspan")
          .attr('class','capitalize')
          .attr("x", 8)
          .attr("y", function(d, i) { return 25; })
          .text(function(d) {
            var arr = d.data.id.replace('data.','').split('.');
            return arr.length > 1 ? arr.slice(arr.length - 2, arr.length).join(' / ') : arr[arr.length - 1].toString();
          });
      text.append("tspan")
          .attr('class','capitalize')
          .attr("x", 8)
          .attr("y", function(d, i) { return 45; })
          .text(function(d) {
            return vm._config._format(d.value);
          });
    }

    cell.append("title")
        .text(function(d) { return d.data.name + "\n" + vm._config._format(d.value); });

    return vm;
  };
  return new Treemap(config);
};

var mexicoMapRounded = function(config) {

  var dataStateLength;

  var testMap = '<svg id="mapa_svg" x="0px" y="0px" width="700" height="460" viewBox="0 0 378.946 278.947" enable-background="new 0 0 378.946 278.947" xml:space="preserve"> <g id="map-wrapper"> <path fill="#d9d9d9" d="M360.542,204.589l0.6-1.032c1.287-2.209,1.288-5.298,0-7.516l-0.598-1.027l0.602-1.033 c1.282-2.207,1.283-5.292-0.002-7.509l-0.597-1.023l0.59-1.01c1.292-2.215,1.291-5.308-0.001-7.518l-0.6-1.027l0.635-1.112 c1.259-2.199,1.259-5.27,0-7.469l-1.12-1.771c-1.261-2.121-3.836-3.488-6.439-3.488h-2.116c-2.661,0-5.272,1.479-6.528,3.736 l-0.68,1.264h-1.142c-2.529,0-5.045,1.34-6.347,3.357l-0.456,0.643h-1.526c-2.866,0-5.37,2.046-6.487,3.952l-0.612,1.048h-1.247 c-2.503,0-5.17,1.568-6.508,3.853l-0.656,1.147h-1.169c-2.552,0-5.218,1.471-6.479,3.645l-1.069,1.81 c-1.271,2.21-1.264,5.275,0.013,7.466l0.606,1.04l-0.605,1.04c-1.284,2.212-1.281,5.3,0.009,7.512l0.594,1.066l-0.21,0.422h-1.206 c-2.613,0-5.221,1.488-6.473,3.677l-0.769,1.323h-1.091c-2.725,0-5.276,1.427-6.536,3.702l-0.689,1.298h-1.121 c-2.6,0-5.069,1.3-6.362,3.329l-0.468,0.671h-0.886l-0.466-0.688c-1.274-2.019-3.756-3.312-6.382-3.312h-1.086l-0.747-1.278 c-1.239-2.226-3.851-3.722-6.499-3.722h-1.144l-0.723-1.255c-1.295-2.205-3.96-3.745-6.482-3.745h-1.187l-0.663-1.19 c-1.319-2.243-3.984-3.81-6.481-3.81h-1.299l-0.113-0.24l0.622-1.1c1.259-2.201,1.257-5.284-0.005-7.479l-1.126-1.743 c-1.444-2.404-4.255-3.438-6.427-3.438h-1.134l-0.274-0.541l0.595-1.05c1.273-2.175,1.299-5.207,0.076-7.416l-0.994-1.929 l-0.118-0.167c-1.118-1.899-3.623-3.897-6.481-3.897h-1.192l0.44-0.834c1.225-2.191,1.212-5.269-0.031-7.45l-0.652-1.155 l0.634-1.105c1.273-2.206,1.271-5.291-0.006-7.498l-0.613-1.061l0.611-1.056c1.29-2.227,1.273-5.325-0.042-7.537l-0.555-0.881 l0.257-0.423h1.149c2.186,0,5.036-1.145,6.436-3.518l1.08-1.783c1.315-2.241,1.315-5.265,0-7.506l-1.07-1.682 c-1.284-2.129-3.864-3.511-6.445-3.511h-1.199l-0.67-1.199c-1.319-2.238-3.983-3.801-6.479-3.801h-1.135l-0.717-1.249 c-1.305-2.209-3.97-3.751-6.48-3.751h-1.265l-0.138-0.287l0.542-0.928c1.335-2.23,1.336-5.36-0.027-7.644l-0.982-1.553 c-1.295-2.172-3.897-3.588-6.478-3.588h-1.062l-0.341-0.638l0.61-1.078c1.265-2.184,1.271-5.22,0.029-7.421l-0.981-1.862 l-0.107-0.145c-1.115-1.88-3.619-3.855-6.48-3.855h-1.372l-0.005-0.058l0.509-0.862c1.33-2.21,1.345-5.299,0.044-7.528l-0.985-1.76 l-0.061-0.057c-1.33-2.227-3.993-3.734-6.476-3.734h-1.225l-0.608-1.124c-1.269-2.282-3.94-3.876-6.498-3.876h-2.117 c-2.542,0-5.215,1.619-6.469,3.881l-0.642,1.119h-1.236c-2.49,0-5.156,1.57-6.523,3.892l-0.625,1.108h-0.443l-0.646-0.868 c-1.569-2.307-4.367-3.132-6.328-3.132h-0.975l-0.717-1.58l-0.137-0.244c-1.12-2.023-3.633-4.177-6.502-4.177h-1.364l-0.016-0.077 l0.497-0.83c1.339-2.21,1.355-5.296,0.052-7.527l-0.967-1.737l-0.076-0.083c-1.102-1.827-3.599-3.746-6.475-3.746h-1.418 l-0.558-0.791c-1.512-2.361-4.253-3.209-6.354-3.209h-1.087l-0.799-1.357c-1.248-2.182-3.835-3.643-6.463-3.643h-2.115 c-2.733,0-5.284,1.413-6.545,3.686l-0.693,1.314h-1.093c-1.987,0-4.841,0.86-6.403,3.277l-0.487,0.723h-0.56l-0.635-1.16 c-1.091-1.85-3.583-3.84-6.479-3.84h-2.116c-2.895,0-5.388,1.993-6.517,3.909l-0.618,1.091h-0.315L93.223,50.9 c-1.088-1.853-3.58-3.847-6.48-3.847h-1.253l-0.597-1.11c-1.272-2.291-3.945-3.89-6.5-3.89H76.98l-0.566-0.801 c-1.509-2.354-4.25-3.199-6.354-3.199h-1.125l-0.739-1.268c-1.288-2.197-3.953-3.732-6.482-3.732h-1.172l-0.68-1.209 c-1.314-2.232-3.979-3.791-6.48-3.791h-1.223l-0.56-1.069l-0.096-0.141c-1.113-1.838-3.612-3.79-6.471-3.79h-1.246l-0.584-1.093 c-1.275-2.3-3.948-3.907-6.5-3.907h-2.115c-2.947,0-5.437,2.069-6.454,3.909l-0.635,1.091h-1.26c-2.86,0-5.36,1.93-6.519,3.847 l-0.948,1.62c-1.356,2.24-1.37,5.366-0.045,7.599l0.578,0.979l-0.606,1.051c-1.28,2.209-1.28,5.295,0,7.504l1.105,1.828 c1.265,2.111,3.836,3.572,6.435,3.572h1.176l0.243,0.378l-0.589,0.989c-1.301,2.215-1.306,5.3-0.011,7.521l0.604,1.03l-0.632,1.103 c-1.263,2.202-1.263,5.274,0.001,7.475l1.102,1.867c1.267,2.148,3.851,3.637,6.454,3.637h1.122l0.708,1.236 c1.231,2.216,3.904,3.764,6.5,3.764h1.221l0.188,0.271l-0.598,1.013c-1.284,2.212-1.284,5.29-0.003,7.496l0.593,1.068l-0.066,0.151 h-1.335c-2.524,0-5.192,1.531-6.511,3.834l-1.051,1.855c-1.258,2.201-1.258,5.265-0.026,7.424l1.1,2.023 c1.287,2.249,3.955,3.863,6.488,3.863h1.251l0.615,1.134c1.094,1.862,3.588,3.866,6.482,3.866h1.437l0.532,0.762 c1.516,2.383,4.26,3.238,6.362,3.238h1.146l0.723,1.258c1.299,2.203,3.964,3.742,6.479,3.742h1.215l0.176,0.25l-0.58,0.966 c-1.295,2.211-1.3,5.29-0.006,7.518l0.603,1.023l-0.632,1.101c-1.261,2.198-1.262,5.268,0.012,7.494l1.054,1.863 c1.259,2.199,3.928,3.785,6.49,3.785h1.178l0.674,1.201c1.248,2.237,3.919,3.799,6.497,3.799h1.262l0.117,0.146l-0.589,0.99 c-1.277,2.21-1.276,5.28,0.002,7.487l1.104,1.811c1.268,2.11,3.838,3.565,6.435,3.565h2.116c2.645,0,5.253-1.514,6.458-3.635 l1.112-1.915c1.271-2.234,1.255-5.241-0.041-7.467l-0.597-1.029l0.6-1.038c1.295-2.225,1.282-5.324-0.013-7.508l-1.04-1.734 c-1.295-2.192-3.96-3.674-6.479-3.674h-1.229l-0.16-0.329l0.548-0.944c1.332-2.229,1.332-5.357-0.045-7.662l-0.968-1.505 c-1.287-2.156-3.889-3.56-6.476-3.56h-1.157l-0.289-0.574l0.624-1.098c1.271-2.18,1.291-5.22,0.061-7.425l-1.012-1.92l-0.092-0.117 c-1.1-1.885-3.598-3.866-6.484-3.866h-1.335l-0.03-0.1l0.522-0.886c1.33-2.228,1.33-5.351,0.043-7.504l-1.058-1.804 c-1.324-2.208-3.986-3.707-6.475-3.707h-1.248l-0.175-0.358l0.59-1.023c1.305-2.218,1.305-5.329,0.001-7.548l-1.097-1.661 c-1.46-2.385-4.262-3.411-6.418-3.411h-1.096l-0.343-0.679l0.632-1.121c1.283-2.195,1.297-5.265,0.04-7.478l-1.023-1.875 l-0.059-0.056c-1.317-2.261-3.983-3.792-6.483-3.792h-1.303l-0.114-0.244l0.614-1.084c1.273-2.206,1.271-5.298-0.005-7.5 l-0.611-1.011l0.119-0.161h0.336l0.699,1.232c1.306,2.219,3.971,3.768,6.48,3.768h1.288l0.106,0.128l-0.582,0.974 c-1.282,2.21-1.281,5.284,0.002,7.492l1.09,1.808c1.272,2.129,3.851,3.598,6.444,3.598h1.178l0.238,0.366l-0.648,1.124 c-1.239,2.17-1.255,5.177-0.049,7.37l1.046,1.984l0.076,0.186c1.08,1.889,3.571,3.97,6.49,3.97h1.379l-0.607,1.011 c-1.238,2.187-1.238,5.217,0.05,7.489l1.033,1.77c1.25,2.209,3.86,3.73,6.494,3.73h1.176l0.672,1.199 c1.313,2.238,3.979,3.801,6.482,3.801h1.329l0.057,0.042l-0.574,0.959c-1.28,2.207-1.28,5.277,0.004,7.491l0.611,1.043l-0.64,1.118 c-1.255,2.196-1.255,5.263-0.036,7.396l1.107,2.061c1.291,2.261,3.96,3.889,6.49,3.889h1.244l0.605,1.12 c1.098,1.868,3.594,3.88,6.482,3.88h1.322l-0.551,0.909c-1.239,2.188-1.238,5.218,0.021,7.436l1.063,1.876 c1.25,2.203,3.92,3.779,6.492,3.779h1.199l0.649,1.175c1.322,2.252,3.988,3.825,6.482,3.825h1.271l0.595,1.109 c1.103,1.874,3.602,3.891,6.483,3.891h1.276l-0.524,0.859c-1.235,2.186-1.234,5.214,0.007,7.406l0.565,0.979l-0.512,0.861 c-1.302,2.218-1.302,5.312,0,7.529l1.078,1.776c1.283,2.12,3.859,3.588,6.438,3.588h1.195l0.235,0.361l-0.632,1.07 c-1.271,2.211-1.264,5.279,0.011,7.473l0.611,1.051l-0.609,1.047c-1.281,2.211-1.28,5.295,0.044,7.573l1.007,1.71 c1.271,2.192,3.878,3.715,6.487,3.715h1.195l0.22,0.33l-0.645,1.106c-1.238,2.165-1.258,5.163-0.059,7.354l1.04,1.999l0.09,0.211 c1.09,1.903,3.585,3.999,6.489,3.999h1.455l0.526,0.755c1.515,2.388,4.262,3.245,6.366,3.245h2.114c2.211,0,5.076-1.109,6.443-3.504 l0.297-0.496h0.932l0.529,0.76c1.519,2.385,4.264,3.24,6.363,3.24h1.09l0.761,1.295c1.284,2.182,3.949,3.705,6.481,3.705h1.212 l0.657,1.188c1.323,2.245,3.987,3.812,6.479,3.812h1.251l0.597,1.109c1.098,1.874,3.595,3.891,6.485,3.891h1.28l0.569,1.076 c1.285,2.311,3.957,3.924,6.497,3.924h1.454l0.509,0.739c1.271,1.987,3.745,3.261,6.367,3.261h1.146l0.717,1.246 c1.284,2.21,3.951,3.754,6.486,3.754h2.116c2.538,0,5.203-1.517,6.481-3.688l0.715-1.312h0.184l0.7,1.229 c1.301,2.22,3.968,3.771,6.484,3.771h2.114c2.535,0,5.2-1.516,6.479-3.686l0.717-1.314h1.135c2.125,0,4.878-1.038,6.355-3.352 l0.458-0.648h0.875l0.51,0.739c1.27,1.987,3.742,3.261,6.366,3.261h1.147l0.714,1.243c1.282,2.212,3.95,3.757,6.488,3.757h1.205 l0.643,1.167c1.325,2.257,3.991,3.833,6.482,3.833h1.275l0.591,1.103c1.104,1.877,3.603,3.897,6.48,3.897h2.118 c2.859,0,5.365-2.104,6.482-4.012l1.072-1.97c1.275-2.232,1.262-5.329-0.025-7.516l-0.61-1.012l0.289-0.491h1.122 c2.123,0,4.876-1.038,6.356-3.351l0.457-0.649h1.532c2.901,0,5.4-2.117,6.542-4.121l1.025-1.922c1.259-2.209,1.26-5.308-0.038-7.589 l-1.037-1.705c-1.266-2.218-3.875-3.663-6.492-3.663h-1.192l-0.221-0.388l0.358-0.612h1.055c2.594,0,5.064-1.3,6.363-3.329 l0.468-0.671h0.843l0.528,0.757c1.515,2.387,4.261,3.243,6.364,3.243h2.115c2.671,0,5.197-1.428,6.457-3.564l1.083-1.808 c1.289-2.225,1.29-5.231-0.016-7.494l-0.588-0.957l0.128-0.177h0.407l0.61,1.129c1.097,1.864,3.593,3.871,6.481,3.871h2.116 c2.876,0,5.375-2.072,6.48-3.949l1.068-1.94c1.274-2.223,1.269-5.315-0.012-7.51L360.542,204.589z M114.262,58.089 c0.03,0.068,0.059,0.139,0.095,0.201c-0.038-0.062-0.087-0.119-0.133-0.178L114.262,58.089z M322.767,187.032 c0.014,0.029,0.024,0.063,0.039,0.091c-0.018-0.027-0.042-0.051-0.061-0.077L322.767,187.032z M282.248,225.191l0.04,0.023 c-0.033,0.047-0.072,0.091-0.102,0.14C282.214,225.307,282.224,225.242,282.248,225.191z M61.749,94.659 c-0.012,0-0.023-0.003-0.035-0.003c0.012,0,0.023-0.003,0.035-0.003V94.659z M353.611,175.919c0.045,0,0.092-0.009,0.138-0.012 v0.023C353.703,175.928,353.656,175.919,353.611,175.919z"/> <g class="states-polygon" id="g_02"> <path class="path_estado" id="est_02" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M65.265,86.638c-0.479-0.819-1.65-1.489-2.6-1.489h-2.094 c-0.95,0-2.109-0.676-2.576-1.503l-1.087-1.921c-0.466-0.827-0.457-2.175,0.021-2.994l1.045-1.793c0.479-0.82,0.479-2.163,0-2.983 l-1.045-1.793c-0.478-0.819-1.646-1.491-2.596-1.491h-2.11c-0.949,0-2.112-0.674-2.583-1.498l-1.07-1.875 c-0.471-0.824-0.47-2.172,0.005-2.994l1.059-1.84c0.475-0.822,0.475-2.167-0.002-2.989l-1.053-1.821 c-0.477-0.822-0.477-2.167,0-2.988l1.052-1.812c0.476-0.822,0.476-2.166-0.001-2.987l-1.051-1.809 c-0.477-0.821-0.477-2.165,0.002-2.985l1.049-1.806c0.477-0.822,0.477-2.165,0-2.986l-1.049-1.805 c-0.479-0.821-0.466-2.157,0.026-2.97l0.994-1.642c0.493-0.812,0.493-2.142,0-2.953l-0.994-1.642 c-0.492-0.812-1.671-1.478-2.622-1.478h-2.094c-0.948,0-2.103-0.678-2.564-1.509l-1.108-1.993c-0.46-0.83-1.615-1.509-2.563-1.509 h-2.115c-0.951,0-2.105,0.679-2.565,1.509l-1.109,1.993c-0.46,0.831-1.614,1.509-2.565,1.509H27.19c-0.95,0-2.13,0.665-2.621,1.478 l-0.996,1.641c-0.491,0.812-0.497,2.146-0.013,2.962l1.022,1.722c0.483,0.817,0.492,2.158,0.019,2.98l-1.058,1.833 c-0.477,0.822-0.477,2.168,0,2.99l1.058,1.833c0.474,0.822,1.639,1.495,2.589,1.495h2.108c0.951,0,2.124,0.669,2.608,1.486 l1.023,1.734c0.485,0.817,0.487,2.155,0.009,2.975l-1.038,1.77c-0.48,0.818-0.482,2.16-0.005,2.979l1.045,1.787 c0.479,0.82,0.484,2.165,0.011,2.989l-1.066,1.865c-0.473,0.824-0.473,2.173,0,2.996l1.066,1.865 c0.474,0.824,1.636,1.498,2.587,1.498h2.094c0.948,0,2.104,0.68,2.564,1.511l1.106,1.992c0.461,0.83,1.617,1.51,2.565,1.51h2.112 c0.947,0,2.128,0.665,2.62,1.476l0.995,1.643c0.491,0.812,0.505,2.148,0.028,2.97l-1.053,1.815c-0.478,0.822-0.478,2.165,0,2.987 l1.053,1.815c0.477,0.821,1.643,1.494,2.593,1.494h2.094c0.95,0,2.12,0.669,2.603,1.487l1.033,1.758 c0.481,0.818,1.652,1.487,2.602,1.487h2.116c0.949,0,2.12-0.669,2.6-1.487l1.035-1.758c0.481-0.818,0.481-2.157,0-2.977 L65.265,86.638z"/> </g> <g class="states-polygon" id="g_03"> <path class="path_estado" id="est_03" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M99.667,148.706c0.478-0.82,0.473-2.162-0.012-2.979l-1.026-1.734 c-0.482-0.816-1.656-1.486-2.605-1.486h-2.095c-0.948,0-2.11-0.674-2.583-1.498l-1.07-1.873c-0.472-0.826-0.458-2.168,0.029-2.982 l1.014-1.701c0.486-0.814,0.486-2.148,0-2.963l-1.014-1.699c-0.487-0.816-1.664-1.484-2.611-1.484h-2.111 c-0.95,0-2.107-0.676-2.573-1.504l-1.093-1.945c-0.464-0.828-0.453-2.176,0.025-2.996l1.043-1.781c0.479-0.82,0.479-2.16,0-2.979 l-1.043-1.781c-0.479-0.82-1.648-1.49-2.598-1.49H77.25c-0.95,0-2.109-0.676-2.578-1.502l-1.081-1.898 c-0.468-0.826-0.453-2.166,0.036-2.982l1.011-1.688c0.486-0.814,0.486-2.148,0-2.963l-1.011-1.686 c-0.489-0.816-1.665-1.483-2.615-1.483h-2.108c-0.95,0-2.105-0.679-2.565-1.509l-1.107-1.992c-0.462-0.83-1.616-1.511-2.565-1.511 h-2.094c-0.95,0-2.121-0.669-2.602-1.487l-1.034-1.758c-0.482-0.818-1.652-1.487-2.603-1.487h-2.115 c-0.95,0-2.121,0.669-2.602,1.487l-1.034,1.758c-0.481,0.818-1.653,1.487-2.601,1.487h-2.112c-0.948,0-2.111,0.675-2.583,1.499 l-1.071,1.875c-0.471,0.824-0.471,2.174,0,3l1.071,1.873c0.472,0.824,1.635,1.5,2.583,1.5h2.112c0.947,0,2.119,0.67,2.601,1.486 l1.034,1.758c0.48,0.818,1.651,1.488,2.602,1.488h2.094c0.95,0,2.12,0.67,2.603,1.488l1.033,1.756 c0.481,0.82,1.652,1.49,2.602,1.49h2.111c0.949,0,2.119,0.668,2.603,1.488l1.032,1.756c0.482,0.818,1.653,1.488,2.603,1.488h2.093 c0.95,0,2.123,0.668,2.606,1.486l1.025,1.732c0.484,0.818,0.486,2.158,0.007,2.977l-1.038,1.77c-0.479,0.818-0.48,2.16-0.004,2.98 l1.045,1.785c0.478,0.82,0.483,2.164,0.012,2.99l-1.067,1.865c-0.472,0.822-0.472,2.172,0,2.996l1.067,1.865 c0.472,0.824,1.635,1.498,2.585,1.498h2.11c0.951,0,2.105,0.68,2.565,1.51l1.106,1.992c0.463,0.83,1.616,1.51,2.566,1.51h2.093 c0.949,0,2.13,0.664,2.623,1.477l0.994,1.643c0.491,0.812,0.505,2.146,0.029,2.969l-1.054,1.814c-0.477,0.824-0.477,2.166,0,2.988 l1.054,1.814c0.476,0.824,1.642,1.494,2.591,1.494h2.116c0.949,0,2.11-0.674,2.58-1.5l1.078-1.898 c0.469-0.824,0.463-2.174-0.015-2.994l-1.051-1.816c-0.477-0.82-0.477-2.166,0-2.986L99.667,148.706z"/> </g> <g class="states-polygon" id="g_26"> <path class="path_estado" id="est_26" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M115.296,67.208c-0.476-0.821-0.466-2.158,0.024-2.973 l1.003-1.663c0.49-0.813,0.49-2.145,0-2.958l-1.003-1.665c-0.49-0.813-1.667-1.479-2.618-1.479h-2.094 c-0.949,0-2.12-0.669-2.601-1.487l-1.034-1.758c-0.482-0.818-1.652-1.487-2.602-1.487h-2.116c-0.949,0-2.12,0.669-2.603,1.487 l-1.033,1.758c-0.48,0.818-1.651,1.487-2.602,1.487h-2.09c-0.948,0-2.119-0.669-2.601-1.487l-1.035-1.758 c-0.48-0.818-1.652-1.487-2.6-1.487h-2.111c-0.95,0-2.104-0.679-2.565-1.51l-1.107-1.993c-0.461-0.83-1.616-1.51-2.565-1.51H77.25 c-0.95,0-2.121-0.669-2.602-1.487l-1.034-1.758c-0.48-0.818-1.652-1.487-2.603-1.487h-2.108c-0.95,0-2.122-0.67-2.604-1.488 l-1.035-1.757c-0.479-0.818-1.65-1.488-2.6-1.488h-2.094c-0.95,0-2.121-0.67-2.602-1.488l-1.034-1.757 c-0.482-0.819-1.652-1.489-2.603-1.489h-2.115c-0.95,0-2.128,0.666-2.617,1.479l-1.003,1.664c-0.489,0.813-0.496,2.147-0.012,2.965 l1.025,1.734c0.484,0.817,0.498,2.163,0.032,2.99l-1.09,1.934c-0.465,0.827-0.465,2.181,0,3.009l1.09,1.934 c0.466,0.826,1.624,1.504,2.574,1.504h2.094c0.95,0,2.12,0.669,2.603,1.487l1.033,1.758c0.481,0.818,1.652,1.487,2.602,1.487h2.111 c0.949,0,2.127,0.666,2.617,1.479l1.002,1.665c0.489,0.813,0.5,2.15,0.024,2.972l-1.05,1.803c-0.477,0.821-0.477,2.164,0,2.984 l1.05,1.805c0.476,0.821,1.645,1.492,2.594,1.492h2.093c0.95,0,2.123,0.669,2.606,1.486l1.025,1.734 c0.484,0.817,0.495,2.161,0.023,2.985l-1.072,1.886c-0.472,0.826-0.472,2.176,0,3.002l1.072,1.885c0.472,0.825,1.633,1.5,2.583,1.5 h2.11c0.951,0,2.126,0.667,2.614,1.481l1.009,1.688c0.489,0.815,0.505,2.158,0.037,2.983l-1.083,1.91 c-0.468,0.826-0.468,2.178,0,3.004l1.083,1.91c0.468,0.826,1.628,1.502,2.578,1.502h2.093c0.949,0,2.121,0.671,2.603,1.489 l1.033,1.756c0.481,0.82,1.652,1.49,2.602,1.49h2.111c0.95,0,2.128,0.664,2.617,1.479l1.004,1.664 c0.489,0.814,0.5,2.15,0.021,2.971l-1.05,1.805c-0.476,0.82-0.476,2.164,0,2.984l1.05,1.805c0.479,0.82,1.646,1.492,2.595,1.492 h2.116c0.949,0,2.119-0.67,2.602-1.488l1.034-1.756c0.48-0.82,1.651-1.488,2.601-1.488h2.094c0.951,0,2.123-0.67,2.604-1.49 l1.031-1.756c0.483-0.818,0.483-2.158,0-2.977l-1.031-1.758c-0.48-0.816-1.652-1.486-2.604-1.486h-2.094 c-0.949,0-2.111-0.676-2.581-1.5l-1.073-1.873c-0.472-0.826-0.472-2.175,0-3l1.073-1.875c0.47-0.824,1.632-1.499,2.581-1.499h2.094 c0.951,0,2.112-0.674,2.584-1.499l1.071-1.874c0.472-0.824,0.469-2.171-0.006-2.995l-1.059-1.839 c-0.477-0.822-0.475-2.167,0.002-2.99l1.053-1.82c0.477-0.822,0.477-2.167,0-2.987l-1.052-1.813c-0.477-0.821-0.476-2.165,0-2.985 l1.05-1.81c0.479-0.821,0.479-2.165,0-2.985L115.296,67.208z"/> </g> <g class="states-polygon" id="g_25"> <path class="path_estado" id="est_25" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M149.707,158.368c0.477-0.82,0.464-2.16-0.026-2.973l-1.003-1.664 c-0.489-0.814-1.666-1.48-2.617-1.48h-2.094c-0.949,0-2.119-0.668-2.602-1.486l-1.033-1.758c-0.481-0.818-1.652-1.488-2.602-1.488 h-2.111c-0.949,0-2.105-0.678-2.568-1.506l-1.099-1.969c-0.466-0.83-0.459-2.182,0.012-3.008l1.076-1.887 c0.469-0.826,0.465-2.174-0.009-2.996l-1.062-1.846c-0.473-0.822-0.46-2.162,0.031-2.975l1.001-1.662 c0.49-0.812,0.49-2.145,0-2.957l-1.001-1.662c-0.491-0.812-1.669-1.479-2.619-1.479h-2.094c-0.95,0-2.106-0.678-2.567-1.508 l-1.102-1.969c-0.462-0.828-0.448-2.178,0.031-2.996l1.038-1.77c0.479-0.818,0.479-2.16,0-2.979l-1.038-1.768 c-0.479-0.82-1.649-1.49-2.6-1.49h-2.115c-0.949,0-2.121,0.67-2.603,1.488l-1.034,1.756c-0.48,0.82-1.651,1.49-2.6,1.49h-2.111 c-0.95,0-2.121,0.668-2.602,1.488l-1.034,1.756c-0.482,0.818-1.651,1.488-2.602,1.488h-2.095c-0.949,0-2.112,0.674-2.583,1.498 l-1.071,1.875c-0.471,0.824-0.471,2.174,0,2.998l1.071,1.875c0.471,0.824,1.634,1.498,2.583,1.498h2.095 c0.95,0,2.119,0.672,2.602,1.49l1.034,1.756c0.48,0.818,1.651,1.488,2.602,1.488h2.111c0.948,0,2.126,0.668,2.611,1.482 l1.012,1.688c0.487,0.814,0.504,2.156,0.035,2.982l-1.082,1.91c-0.468,0.826-0.468,2.18,0,3.004l1.082,1.91 c0.469,0.826,1.629,1.502,2.578,1.502h2.094c0.95,0,2.121,0.67,2.602,1.488l1.034,1.758c0.48,0.818,1.651,1.486,2.602,1.486h2.109 c0.951,0,2.121,0.672,2.604,1.49l1.031,1.756c0.481,0.818,1.653,1.488,2.604,1.488h2.094c0.948,0,2.123,0.666,2.612,1.482 l1.011,1.688c0.487,0.814,0.504,2.156,0.036,2.982l-1.083,1.908c-0.468,0.828-0.468,2.18,0,3.006l1.083,1.91 c0.468,0.826,1.626,1.502,2.576,1.502h2.115c0.951,0,2.107-0.68,2.57-1.508l1.1-1.969c0.462-0.83,0.453-2.18-0.023-3l-1.053-1.816 c-0.478-0.82-0.478-2.166,0-2.988L149.707,158.368z"/> </g> <g class="states-polygon" id="g_08"> <path class="path_estado" id="est_08" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M165.333,86.366c-0.478-0.821-0.455-2.152,0.05-2.958l0.954-1.526 c0.502-0.806,0.502-2.124,0-2.93l-0.954-1.526c-0.505-0.805-1.691-1.464-2.644-1.464h-2.091c-0.95,0-2.104-0.68-2.566-1.51 l-1.108-1.992c-0.46-0.831-1.615-1.51-2.564-1.51h-2.11c-0.949,0-2.104-0.68-2.565-1.51l-1.106-1.992 c-0.462-0.83-0.435-2.175,0.056-2.986l0.995-1.642c0.492-0.812,0.492-2.142,0-2.953l-0.995-1.641 c-0.49-0.812-1.671-1.478-2.622-1.478h-2.094c-0.949,0-2.119-0.669-2.602-1.487l-1.033-1.758c-0.481-0.817-1.652-1.487-2.602-1.487 h-2.111c-0.949,0-2.104-0.679-2.565-1.51l-1.105-1.993c-0.462-0.83-1.616-1.51-2.566-1.51h-2.115c-0.95,0-2.104,0.68-2.564,1.51 l-1.107,1.993c-0.463,0.831-1.615,1.51-2.565,1.51h-2.094c-0.949,0-2.138,0.658-2.641,1.464l-0.955,1.526 c-0.503,0.806-0.515,2.13-0.025,2.943l1.003,1.665c0.491,0.813,0.496,2.146,0.012,2.964l-1.025,1.734 c-0.483,0.817-0.487,2.156-0.007,2.976l1.038,1.768c0.48,0.82,0.483,2.16,0.002,2.981l-1.042,1.786 c-0.479,0.819-0.479,2.162-0.001,2.982l1.046,1.795c0.479,0.821,0.479,2.164,0.001,2.984l-1.048,1.799 c-0.479,0.821-0.49,2.172-0.028,3.002l1.104,1.99c0.462,0.83,0.462,2.188,0,3.019l-1.104,1.991 c-0.462,0.83-1.617,1.508-2.565,1.508h-2.111c-0.95,0-2.112,0.675-2.585,1.5l-1.07,1.874c-0.471,0.824-0.471,2.174,0,2.999 l1.07,1.873c0.473,0.824,1.635,1.5,2.585,1.5h2.111c0.948,0,2.119,0.67,2.6,1.488l1.034,1.756c0.481,0.82,1.653,1.49,2.603,1.49 h2.094c0.95,0,2.135,0.66,2.634,1.469l0.971,1.572c0.499,0.809,0.526,2.146,0.063,2.977l-1.099,1.969 c-0.463,0.83-0.463,2.186,0,3.016l1.099,1.969c0.463,0.83,1.619,1.508,2.569,1.508h2.115c0.95,0,2.104-0.68,2.566-1.51l1.105-1.994 c0.462-0.83,1.616-1.508,2.565-1.508h2.111c0.949,0,2.12-0.67,2.602-1.488l1.033-1.758c0.482-0.818,1.652-1.488,2.602-1.488h2.09 c0.949,0,2.12,0.67,2.603,1.488l1.033,1.758c0.48,0.818,1.651,1.488,2.603,1.488h2.114c0.949,0,2.12-0.67,2.603-1.488l1.034-1.758 c0.48-0.818,1.652-1.488,2.603-1.488h2.091c0.952,0,2.104-0.68,2.562-1.51l1.113-2.018c0.461-0.83,0.454-2.188-0.015-3.014 l-1.082-1.91c-0.468-0.826-0.464-2.176,0.01-3l1.063-1.857c0.474-0.822,0.471-2.169-0.003-2.992l-1.058-1.83 c-0.476-0.822-0.476-2.167,0.002-2.988l1.054-1.817c0.476-0.821,0.476-2.167,0-2.987L165.333,86.366z"/> </g> <g class="states-polygon" id="g_10"> <path class="path_estado" id="est_10" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M173.678,129.47c-0.476-0.822-0.468-2.164,0.016-2.982 l1.026-1.734c0.483-0.816,0.483-2.154,0-2.973l-1.026-1.732c-0.483-0.818-1.656-1.486-2.605-1.486h-2.108 c-0.951,0-2.122-0.67-2.603-1.488l-1.033-1.756c-0.481-0.82-1.652-1.488-2.604-1.488h-2.113c-0.949,0-2.121,0.668-2.603,1.488 l-1.033,1.756c-0.482,0.818-1.653,1.488-2.602,1.488h-2.09c-0.949,0-2.12-0.67-2.602-1.488l-1.034-1.756 c-0.48-0.82-1.651-1.488-2.603-1.488h-2.115c-0.95,0-2.119,0.668-2.602,1.488l-1.034,1.756c-0.48,0.818-1.651,1.488-2.6,1.488 h-2.094c-0.951,0-2.124,0.668-2.608,1.486l-1.023,1.732c-0.485,0.818-0.487,2.158-0.007,2.977l1.036,1.77 c0.48,0.818,0.483,2.16,0.005,2.98l-1.043,1.785c-0.48,0.82-0.48,2.162-0.003,2.984l1.046,1.793c0.479,0.822,0.49,2.172,0.026,3 l-1.099,1.965c-0.464,0.828-0.464,2.184,0,3.014l1.099,1.965c0.464,0.828,1.62,1.506,2.571,1.506h2.094 c0.948,0,2.119,0.67,2.6,1.488l1.034,1.758c0.482,0.818,1.651,1.486,2.602,1.486h2.111c0.949,0,2.128,0.666,2.618,1.48l1.001,1.664 c0.491,0.812,0.5,2.15,0.023,2.973l-1.048,1.803c-0.478,0.82-0.478,2.164,0,2.986l1.048,1.803c0.477,0.82,1.645,1.492,2.596,1.492 h2.114c0.949,0,2.12-0.67,2.603-1.49l1.034-1.754c0.48-0.82,1.652-1.49,2.603-1.49h2.091c0.952,0,2.111-0.674,2.581-1.5 l1.079-1.898c0.47-0.824,0.451-2.168-0.034-2.982l-1.011-1.688c-0.486-0.814-0.486-2.146,0-2.963l1.011-1.686 c0.485-0.816,1.663-1.482,2.614-1.482h2.108c0.949,0,2.105-0.678,2.568-1.506l1.101-1.969c0.464-0.83,0.457-2.182-0.012-3.008 l-1.075-1.887c-0.472-0.826-0.468-2.174,0.008-2.996l1.06-1.846c0.477-0.822,0.477-2.17,0-2.992L173.678,129.47z"/> </g> <g class="states-polygon" id="g_18"> <path class="path_estado" id="est_18" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M165.344,172.675c-0.481-0.82-1.652-1.488-2.604-1.488h-2.091 c-0.95,0-2.104-0.68-2.566-1.51l-1.108-1.994c-0.46-0.83-1.615-1.508-2.564-1.508h-2.114c-0.951,0-2.104,0.678-2.565,1.508 l-1.107,1.994c-0.462,0.83-1.616,1.51-2.565,1.51h-2.111c-0.95,0-2.119,0.668-2.602,1.488l-1.034,1.756 c-0.48,0.818-0.48,2.158,0,2.977l1.034,1.756c0.482,0.82,1.651,1.49,2.602,1.49h2.111c0.949,0,2.12,0.668,2.603,1.488l1.033,1.755 c0.48,0.818,1.651,1.49,2.603,1.49h2.114c0.949,0,2.12-0.672,2.603-1.49l1.034-1.755c0.48-0.82,1.652-1.488,2.603-1.488h2.091 c0.952,0,2.123-0.67,2.604-1.49l1.033-1.756c0.48-0.818,0.48-2.158,0-2.977L165.344,172.675z"/> </g> <g class="states-polygon" id="g_06"> <path fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M173.672,215.564c-0.47-0.824-1.635-1.5-2.584-1.5h-2.108 c-0.951,0-2.122-0.67-2.603-1.488l-1.033-1.758c-0.481-0.818-1.652-1.486-2.604-1.486h-2.113c-0.949,0-2.113,0.674-2.584,1.498 l-1.07,1.873c-0.473,0.826-0.473,2.174,0,3l1.07,1.875c0.471,0.822,1.635,1.498,2.584,1.498h2.11c0.948,0,2.119,0.67,2.602,1.49 l1.033,1.756c0.479,0.818,1.654,1.488,2.603,1.488h2.114c0.949,0,2.114-0.676,2.584-1.498l1.072-1.877 c0.47-0.824,0.47-2.174,0-2.998L173.672,215.564z"/> <path class="path_estado" id="est_06" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M173.672,215.564c-0.47-0.824-1.635-1.5-2.584-1.5h-2.108 c-0.951,0-2.122-0.67-2.603-1.488l-1.033-1.758c-0.481-0.818-1.652-1.486-2.604-1.486h-2.113c-0.949,0-2.113,0.674-2.584,1.498 l-1.07,1.873c-0.473,0.826-0.473,2.174,0,3l1.07,1.875c0.471,0.822,1.635,1.498,2.584,1.498h2.11c0.948,0,2.119,0.67,2.602,1.49 l1.033,1.756c0.479,0.818,1.654,1.488,2.603,1.488h2.114c0.949,0,2.114-0.676,2.584-1.498l1.072-1.877 c0.47-0.824,0.47-2.174,0-2.998L173.672,215.564z"/> </g> <g class="states-polygon" id="g_01"> <path class="path_estado" id="est_01" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M190.352,167.673c-0.471-0.824-1.634-1.498-2.582-1.498h-2.117 c-0.95,0-2.104,0.678-2.565,1.508l-1.107,1.994c-0.462,0.83-1.615,1.51-2.565,1.51h-2.108c-0.95,0-2.122,0.668-2.604,1.488 l-1.034,1.756c-0.479,0.818-0.479,2.158,0,2.977l1.034,1.756c0.482,0.82,1.654,1.49,2.604,1.49h2.115 c0.948,0,2.119-0.67,2.602-1.49l1.034-1.756c0.48-0.818,1.651-1.488,2.6-1.488h2.113c0.948,0,2.111-0.674,2.582-1.498l1.07-1.875 c0.472-0.824,0.472-2.174,0-2.998L190.352,167.673z"/> </g> <g class="states-polygon" id="g_14"> <path class="path_estado" id="est_14" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M190.369,177.407c-0.48-0.818-1.651-1.488-2.6-1.488h-2.117 c-0.95,0-2.119,0.67-2.603,1.488l-1.033,1.756c-0.48,0.82-1.652,1.49-2.603,1.49h-2.089c-0.948,0-2.115-0.672-2.594-1.494 l-1.049-1.803c-0.477-0.822-0.48-2.166-0.007-2.99l1.064-1.85c0.474-0.824,0.474-2.172,0-2.994l-1.064-1.85 c-0.474-0.824-1.639-1.498-2.588-1.498h-2.114c-0.948,0-2.115,0.674-2.587,1.498l-1.062,1.85c-0.476,0.822-0.474,2.168,0.004,2.992 l1.055,1.826c0.475,0.822,0.475,2.168,0,2.99l-1.055,1.828c-0.478,0.82-1.644,1.494-2.592,1.494h-2.11 c-0.949,0-2.121,0.668-2.603,1.488l-1.033,1.755c-0.482,0.818-1.653,1.49-2.602,1.49h-2.094c-0.951,0-2.116,0.672-2.592,1.494 l-1.058,1.826c-0.474,0.824-0.472,2.168,0.005,2.988l1.051,1.816c0.477,0.822,0.477,2.166,0,2.986l-1.051,1.811 c-0.477,0.822-0.477,2.166,0,2.986l1.051,1.809c0.477,0.822,1.643,1.494,2.594,1.494h2.094c0.948,0,2.119,0.668,2.602,1.488 l1.033,1.756c0.481,0.818,1.653,1.49,2.603,1.49h2.11c0.948,0,2.119,0.668,2.602,1.486l1.033,1.758 c0.479,0.818,1.654,1.488,2.603,1.488h2.114c0.949,0,2.122-0.67,2.602-1.488l1.033-1.758c0.482-0.818,1.654-1.486,2.603-1.486 h2.096c0.948,0,2.117-0.672,2.598-1.492l1.04-1.779c0.48-0.82,0.48-2.162,0.002-2.982l-1.044-1.791 c-0.479-0.82-0.479-2.162-0.002-2.984l1.049-1.797c0.476-0.822,0.479-2.164,0.004-2.986l-1.056-1.826 c-0.476-0.82-0.476-2.166,0-2.988l1.056-1.824c0.476-0.822,1.641-1.494,2.589-1.494h2.113c0.948,0,2.119-0.672,2.6-1.49 l1.035-1.755c0.481-0.82,0.481-2.158,0-2.979L190.369,177.407z"/> </g> <g class="states-polygon" id="g_05"> <path class="path_estado" id="est_05" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M208.093,96.055c0.477-0.822,0.468-2.162-0.018-2.979l-1.019-1.71 c-0.484-0.816-1.659-1.483-2.61-1.483h-2.108c-0.952,0-2.111-0.677-2.58-1.502l-1.08-1.897c-0.47-0.825-0.451-2.167,0.036-2.983 l1.009-1.687c0.49-0.814,0.49-2.148,0-2.963l-1.009-1.687c-0.487-0.815-1.664-1.481-2.613-1.481h-2.095 c-0.948,0-2.104-0.68-2.565-1.51l-1.106-1.992c-0.462-0.831-1.616-1.511-2.564-1.511h-2.117c-0.95,0-2.104,0.68-2.565,1.511 l-1.107,1.992c-0.462,0.83-1.615,1.51-2.565,1.51h-2.108c-0.95,0-2.122,0.67-2.604,1.488l-1.034,1.757 c-0.479,0.818-1.649,1.488-2.6,1.488h-2.094c-0.948,0-2.128,0.666-2.619,1.479l-1.002,1.665c-0.489,0.813-0.493,2.147-0.011,2.965 l1.026,1.732c0.482,0.817,0.486,2.157,0.006,2.977l-1.038,1.768c-0.481,0.819-0.481,2.16-0.003,2.981l1.043,1.786 c0.479,0.82,0.479,2.162,0.001,2.982l-1.046,1.794c-0.479,0.822-0.479,2.164,0,2.984l1.049,1.799 c0.475,0.822,0.48,2.168,0.011,2.992l-1.07,1.871c-0.473,0.824-0.473,2.174,0,2.998l1.07,1.873c0.47,0.824,1.635,1.498,2.583,1.498 h2.094c0.95,0,2.122,0.668,2.606,1.486l1.025,1.732c0.482,0.818,0.493,2.162,0.023,2.988l-1.075,1.885c-0.47,0.826-0.47,2.176,0,3 l1.075,1.887c0.47,0.824,1.633,1.5,2.583,1.5h2.108c0.95,0,2.122,0.67,2.603,1.488l1.033,1.758 c0.483,0.816,1.652,1.486,2.603,1.486h2.095c0.948,0,2.119,0.67,2.603,1.49l1.032,1.756c0.481,0.816,1.653,1.488,2.603,1.488h2.116 c0.949,0,2.11-0.674,2.581-1.498l1.073-1.873c0.47-0.826,0.469-2.174-0.007-2.996l-1.06-1.84c-0.474-0.822-0.474-2.168,0.003-2.99 l1.053-1.822c0.478-0.822,0.478-2.164,0-2.986l-1.052-1.812c-0.476-0.822-0.476-2.166,0-2.986l1.052-1.809 c0.476-0.822,0.469-2.16-0.021-2.975l-1.009-1.689c-0.487-0.814-0.487-2.148,0-2.965l1.009-1.689c0.49-0.812,1.663-1.48,2.615-1.48 h2.108c0.951,0,2.109-0.676,2.576-1.504l1.087-1.92c0.469-0.828,0.46-2.176-0.017-2.998l-1.053-1.815 c-0.477-0.821-0.477-2.167,0-2.987L208.093,96.055z"/> </g> <g class="states-polygon" id="g_32"> <path class="path_estado" id="est_32" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M198.682,144.007c-0.471-0.824-1.632-1.5-2.581-1.5h-2.095 c-0.948,0-2.12-0.672-2.602-1.488l-1.035-1.756c-0.48-0.82-1.651-1.49-2.6-1.49h-2.113c-0.948,0-2.119-0.67-2.6-1.486l-1.034-1.758 c-0.482-0.818-1.653-1.488-2.602-1.488h-2.115c-0.95,0-2.128,0.668-2.615,1.482l-1.01,1.688c-0.487,0.814-0.503,2.156-0.037,2.982 l1.083,1.91c0.468,0.826,0.468,2.18,0,3.004l-1.083,1.91c-0.466,0.826-1.626,1.502-2.576,1.502h-2.094 c-0.948,0-2.128,0.664-2.623,1.477l-0.994,1.643c-0.491,0.812-0.504,2.146-0.027,2.969l1.051,1.814 c0.478,0.824,0.478,2.166,0,2.988l-1.051,1.814c-0.477,0.824-1.645,1.494-2.593,1.494h-2.11c-0.949,0-2.113,0.678-2.584,1.5 l-1.07,1.875c-0.473,0.824-0.473,2.174,0,2.998l1.07,1.875c0.471,0.822,1.635,1.498,2.584,1.498h2.113 c0.952,0,2.105-0.68,2.566-1.51l1.108-1.992c0.459-0.83,1.614-1.51,2.565-1.51h2.088c0.95,0,2.104,0.68,2.564,1.51l1.108,1.992 c0.46,0.83,1.615,1.51,2.565,1.51h2.115c0.948,0,2.104-0.68,2.568-1.508l1.099-1.969c0.464-0.83,0.449-2.178-0.031-2.996 l-1.036-1.77c-0.48-0.818-0.48-2.158,0-2.979l1.036-1.77c0.48-0.818,1.651-1.488,2.6-1.488h2.113c0.948,0,2.119-0.67,2.6-1.488 l1.035-1.756c0.481-0.818,1.653-1.49,2.602-1.49h2.095c0.949,0,2.11-0.674,2.581-1.498l1.073-1.875c0.47-0.824,0.47-2.172,0-2.998 L198.682,144.007z"/> </g> <g class="states-polygon" id="g_11"> <path class="path_estado" id="est_11" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M207.048,177.407c-0.48-0.818-1.65-1.488-2.602-1.488h-2.108 c-0.952,0-2.122-0.67-2.603-1.488l-1.033-1.756c-0.482-0.82-1.652-1.488-2.602-1.488h-2.116c-0.949,0-2.121,0.668-2.603,1.488 l-1.032,1.756c-0.483,0.82-0.483,2.158,0,2.977l1.032,1.756c0.481,0.82,0.481,2.158,0,2.979l-1.032,1.755 c-0.483,0.818-1.654,1.49-2.603,1.49h-2.095c-0.95,0-2.111,0.674-2.582,1.498l-1.072,1.875c-0.471,0.822-0.471,2.172,0,2.998 l1.072,1.873c0.471,0.826,1.632,1.5,2.582,1.5h2.095c0.948,0,2.119,0.668,2.603,1.488l1.032,1.758 c0.481,0.818,1.653,1.488,2.603,1.488h2.116c0.949,0,2.114-0.674,2.588-1.496l1.059-1.826c0.475-0.822,0.477-2.168,0.001-2.992 l-1.06-1.838c-0.474-0.824-0.474-2.168,0-2.992l1.06-1.838c0.476-0.822,1.638-1.496,2.59-1.496h2.108 c0.951,0,2.121-0.672,2.602-1.49l1.034-1.755c0.481-0.82,0.481-2.158,0-2.979L207.048,177.407z"/> </g> <g class="states-polygon" id="g_16"> <path class="path_estado" id="est_16" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M208.082,201.354c0.481-0.82,0.481-2.158,0-2.977l-1.034-1.758 c-0.48-0.82-1.65-1.488-2.602-1.488h-2.114c-0.949,0-2.119,0.668-2.602,1.488l-1.033,1.758c-0.482,0.818-1.654,1.488-2.603,1.488 h-2.089c-0.948,0-2.12-0.67-2.602-1.488l-1.035-1.758c-0.48-0.82-1.651-1.488-2.6-1.488h-2.117c-0.95,0-2.119,0.668-2.603,1.488 l-1.033,1.758c-0.482,0.818-0.48,2.156,0,2.977l1.033,1.756c0.483,0.818,0.483,2.158,0,2.977l-1.033,1.756 c-0.48,0.818-1.652,1.49-2.603,1.49h-2.108c-0.95,0-2.113,0.674-2.583,1.498l-1.072,1.873c-0.473,0.826-0.473,2.174,0,3 l1.072,1.875c0.47,0.822,1.633,1.498,2.583,1.498h2.108c0.95,0,2.122,0.67,2.603,1.49l1.033,1.756 c0.483,0.818,1.652,1.488,2.603,1.488h2.117c0.948,0,2.119-0.67,2.6-1.488l1.035-1.756c0.481-0.82,1.653-1.49,2.602-1.49h2.095 c0.949,0,2.104-0.68,2.564-1.51l1.107-1.992c0.463-0.83,1.613-1.51,2.565-1.51h2.108c0.951,0,2.121-0.67,2.602-1.488l1.034-1.756 c0.481-0.82,0.481-2.16,0-2.979l-1.034-1.756c-0.48-0.818-0.48-2.158,0-2.977L208.082,201.354z"/> </g> <g class="states-polygon" id="g_19"> <path class="path_estado" id="est_19" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M224.771,124.763c0.477-0.822,0.471-2.164-0.013-2.982 l-1.026-1.732c-0.483-0.818-1.656-1.486-2.605-1.486h-2.11c-0.948,0-2.111-0.674-2.585-1.498l-1.069-1.875 c-0.472-0.824-0.458-2.166,0.028-2.982l1.015-1.697c0.487-0.814,0.487-2.15,0-2.967l-1.015-1.697 c-0.486-0.816-1.663-1.482-2.611-1.482h-2.114c-0.952,0-2.122,0.67-2.603,1.486l-1.033,1.758c-0.483,0.818-1.652,1.488-2.603,1.488 h-2.095c-0.949,0-2.126,0.668-2.614,1.48l-1.01,1.689c-0.488,0.814-0.491,2.15-0.009,2.967l1.029,1.746 c0.48,0.818,0.484,2.158,0.004,2.977l-1.04,1.775c-0.48,0.82-0.48,2.16-0.001,2.98l1.044,1.789c0.479,0.82,0.479,2.162,0,2.984 l-1.047,1.795c-0.477,0.822-0.478,2.164,0,2.986l1.049,1.799c0.477,0.82,0.477,2.164,0,2.986l-1.049,1.801 c-0.478,0.82-0.478,2.164,0,2.984l1.049,1.803c0.477,0.82,0.486,2.17,0.019,2.996l-1.085,1.922c-0.467,0.826-0.467,2.178,0,3.006 l1.085,1.92c0.468,0.828,1.627,1.504,2.576,1.504h2.114c0.951,0,2.121-0.67,2.602-1.488l1.034-1.756 c0.481-0.818,1.652-1.49,2.603-1.49h2.095c0.948,0,2.107-0.676,2.57-1.504l1.094-1.945c0.465-0.828,0.453-2.176-0.026-2.996 l-1.041-1.779c-0.478-0.82-0.478-2.162,0-2.982l1.041-1.781c0.479-0.818,1.651-1.49,2.6-1.49h2.11c0.949,0,2.111-0.674,2.58-1.5 l1.077-1.896c0.469-0.826,0.464-2.176-0.013-2.996l-1.051-1.816c-0.477-0.82-0.477-2.164,0-2.988L224.771,124.763z"/> </g> <g class="states-polygon" id="g_24"> <path class="path_estado" id="est_24" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M224.771,172.651c0.477-0.82,0.471-2.162-0.013-2.979 l-1.026-1.734c-0.483-0.818-1.656-1.486-2.605-1.486h-2.11c-0.948,0-2.12-0.67-2.603-1.49l-1.034-1.754 c-0.481-0.82-1.652-1.49-2.601-1.49h-2.095c-0.95,0-2.121-0.668-2.603-1.486l-1.034-1.758c-0.48-0.818-1.65-1.488-2.602-1.488 h-2.108c-0.952,0-2.122-0.67-2.603-1.488l-1.033-1.756c-0.482-0.818-1.652-1.49-2.602-1.49h-2.116c-0.949,0-2.121,0.672-2.603,1.49 l-1.032,1.756c-0.483,0.818-1.654,1.488-2.603,1.488h-2.095c-0.95,0-2.119,0.67-2.603,1.488l-1.033,1.758 c-0.48,0.818-0.48,2.156,0,2.977l1.033,1.754c0.483,0.82,1.652,1.49,2.603,1.49h2.095c0.948,0,2.104,0.68,2.564,1.51l1.107,1.992 c0.461,0.83,1.616,1.51,2.565,1.51h2.11c0.948,0,2.12,0.67,2.603,1.488l1.033,1.758c0.482,0.818,1.652,1.486,2.602,1.486h2.095 c0.95,0,2.119,0.672,2.603,1.49l1.033,1.756c0.48,0.82,1.65,1.488,2.603,1.488h2.108c0.95,0,2.122,0.672,2.603,1.488l1.034,1.757 c0.48,0.818,1.651,1.488,2.602,1.488h2.115c0.949,0,2.111-0.674,2.58-1.5l1.077-1.897c0.469-0.826,0.464-2.176-0.013-2.996 l-1.051-1.814c-0.477-0.822-0.477-2.168,0-2.988L224.771,172.651z"/> </g> <g class="states-polygon" id="g_22"> <path fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M216.423,186.936c0.478-0.822,0.478-2.166-0.002-2.986 l-1.048-1.804c-0.477-0.822-1.646-1.492-2.594-1.492h-2.114c-0.952,0-2.122,0.668-2.603,1.488l-1.033,1.755 c-0.483,0.818-1.652,1.49-2.603,1.49h-2.095c-0.949,0-2.112,0.674-2.584,1.498l-1.07,1.875c-0.472,0.822-0.472,2.172,0,2.998 l1.07,1.873c0.472,0.826,1.635,1.5,2.584,1.5h2.095c0.95,0,2.119,0.668,2.603,1.488l1.033,1.758c0.48,0.818,1.65,1.488,2.603,1.488 h2.114c0.948,0,2.116-0.674,2.59-1.496l1.056-1.826c0.477-0.822,0.476-2.168-0.002-2.99l-1.052-1.814 c-0.476-0.82-0.476-2.164,0-2.988L216.423,186.936z"/> <path class="path_estado" id="est_22" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M216.423,186.936c0.478-0.822,0.478-2.166-0.002-2.986 l-1.048-1.804c-0.477-0.822-1.646-1.492-2.594-1.492h-2.114c-0.952,0-2.122,0.668-2.603,1.488l-1.033,1.755 c-0.483,0.818-1.652,1.49-2.603,1.49h-2.095c-0.949,0-2.112,0.674-2.584,1.498l-1.07,1.875c-0.472,0.822-0.472,2.172,0,2.998 l1.07,1.873c0.472,0.826,1.635,1.5,2.584,1.5h2.095c0.95,0,2.119,0.668,2.603,1.488l1.033,1.758c0.48,0.818,1.65,1.488,2.603,1.488 h2.114c0.948,0,2.116-0.674,2.59-1.496l1.056-1.826c0.477-0.822,0.476-2.168-0.002-2.99l-1.052-1.814 c-0.476-0.82-0.476-2.164,0-2.988L216.423,186.936z"/> </g> <g class="states-polygon" id="g_15"> <path class="path_estado" id="est_15" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M223.729,196.619c-0.482-0.82-1.653-1.488-2.603-1.488h-2.115 c-0.95,0-2.121,0.668-2.602,1.488l-1.034,1.758c-0.48,0.818-1.652,1.488-2.603,1.488h-2.108c-0.952,0-2.122,0.672-2.599,1.49 l-1.042,1.779c-0.479,0.82-0.479,2.164-0.002,2.982l1.045,1.791c0.479,0.822,0.482,2.166,0.008,2.988l-1.062,1.846 c-0.475,0.822-0.475,2.172,0,2.992l1.062,1.846c0.475,0.824,1.638,1.496,2.59,1.496h2.114c0.948,0,2.114-0.672,2.586-1.496 l1.062-1.852c0.476-0.824,0.474-2.17-0.001-2.992l-1.058-1.826c-0.474-0.824-0.474-2.168,0-2.99l1.058-1.828 c0.475-0.822,1.642-1.494,2.59-1.494h2.11c0.949,0,2.12-0.67,2.603-1.488l1.032-1.758c0.481-0.818,0.481-2.156,0-2.975 L223.729,196.619z"/> </g> <g class="states-polygon" id="g_09"> <path class="path_estado" id="est_09" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M219.012,214.064c-0.95,0-2.121-0.67-2.602-1.488l-1.034-1.758 c-0.48-0.818-0.48-2.158,0-2.977l1.034-1.756c0.48-0.82,1.651-1.488,2.602-1.488h2.115c0.949,0,2.12,0.668,2.603,1.488l1.032,1.756 c0.481,0.818,0.481,2.158,0,2.977l-1.032,1.758c-0.482,0.818-1.653,1.488-2.603,1.488H219.012z"/> </g> <g class="states-polygon" id="g_28"> <path class="path_estado" id="est_28" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M240.409,129.796c-0.481-0.818-1.653-1.49-2.603-1.49h-2.11 c-0.949,0-2.12-0.668-2.602-1.486l-1.034-1.758c-0.482-0.818-1.653-1.488-2.602-1.488h-2.117c-0.948,0-2.128,0.666-2.62,1.477 l-0.995,1.641c-0.493,0.812-0.506,2.15-0.028,2.971l1.052,1.816c0.477,0.822,0.477,2.166,0,2.988l-1.052,1.814 c-0.478,0.822-1.643,1.492-2.594,1.492h-2.093c-0.95,0-2.126,0.668-2.61,1.484l-1.017,1.711c-0.486,0.814-0.5,2.16-0.031,2.984 l1.078,1.898c0.47,0.826,0.47,2.176,0,3.002l-1.078,1.898c-0.469,0.826-1.63,1.5-2.58,1.5h-2.108c-0.952,0-2.122,0.672-2.603,1.49 l-1.033,1.756c-0.483,0.818-0.483,2.158,0,2.977l1.033,1.758c0.48,0.818,1.65,1.486,2.603,1.486h2.108 c0.95,0,2.122,0.67,2.603,1.49l1.034,1.754c0.48,0.82,1.651,1.49,2.602,1.49h2.093c0.951,0,2.104,0.68,2.564,1.51l1.108,1.992 c0.462,0.83,1.616,1.51,2.564,1.51h2.117c0.948,0,2.104-0.68,2.569-1.508l1.099-1.969c0.464-0.83,0.458-2.182-0.013-3.008 l-1.073-1.885c-0.472-0.824-0.467-2.174,0.005-2.998l1.062-1.844c0.475-0.822,0.473-2.17-0.003-2.992l-1.056-1.824 c-0.475-0.822-0.474-2.166,0.004-2.986l1.051-1.814c0.477-0.822,0.47-2.162-0.016-2.979l-1.021-1.715 c-0.484-0.818-0.484-2.152,0-2.969l1.021-1.717c0.485-0.816,1.659-1.484,2.608-1.484h2.11c0.949,0,2.121-0.67,2.603-1.486 l1.032-1.758c0.48-0.818,0.48-2.158,0-2.977L240.409,129.796z"/> </g> <g class="states-polygon" id="g_13"> <path class="path_estado" id="est_13" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M232.061,182.142c-0.482-0.82-1.653-1.488-2.602-1.488h-2.117 c-0.948,0-2.119,0.668-2.603,1.488l-1.032,1.755c-0.482,0.818-1.651,1.49-2.603,1.49h-2.093c-0.95,0-2.111,0.674-2.584,1.498 l-1.071,1.875c-0.47,0.822-0.47,2.172,0,2.998l1.071,1.873c0.473,0.826,1.634,1.5,2.584,1.5h2.115c0.949,0,2.103-0.68,2.565-1.508 l1.107-1.994c0.461-0.832,1.615-1.51,2.565-1.51h2.094c0.948,0,2.119-0.67,2.602-1.488l1.034-1.758 c0.481-0.816,0.481-2.158,0-2.977L232.061,182.142z"/> </g> <g class="states-polygon" id="g_29"> <path class="path_estado" id="est_29" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M227.342,209.332c-0.948,0-2.119-0.672-2.603-1.49l-1.032-1.756 c-0.482-0.82-0.482-2.158,0-2.977l1.032-1.758c0.483-0.818,1.654-1.486,2.603-1.486h2.117c0.948,0,2.119,0.668,2.602,1.486 l1.034,1.758c0.481,0.818,0.481,2.156,0,2.977l-1.034,1.756c-0.482,0.818-1.653,1.49-2.602,1.49H227.342z"/> </g> <g class="states-polygon" id="g_21"> <path class="path_estado" id="est_21" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M240.405,206.092c-0.477-0.822-0.474-2.164,0.009-2.982 l1.034-1.756c0.48-0.82,0.48-2.158,0-2.977l-1.034-1.758c-0.482-0.82-1.651-1.488-2.602-1.488h-2.111 c-0.948,0-2.103-0.68-2.564-1.508l-1.108-1.994c-0.461-0.832-1.615-1.51-2.564-1.51h-2.116c-0.949,0-2.11,0.674-2.582,1.5 l-1.071,1.875c-0.472,0.822-0.472,2.172,0,2.996l1.071,1.875c0.472,0.826,1.633,1.5,2.582,1.5h2.111 c0.948,0,2.119,0.668,2.602,1.486l1.034,1.758c0.481,0.818,0.481,2.156,0,2.977l-1.034,1.756c-0.482,0.818-1.653,1.49-2.602,1.49 h-2.111c-0.949,0-2.11,0.674-2.582,1.498l-1.071,1.873c-0.472,0.826-0.472,2.174,0,3l1.071,1.875 c0.472,0.822,1.633,1.498,2.582,1.498h2.111c0.948,0,2.119,0.67,2.602,1.49l1.034,1.756c0.481,0.818,1.652,1.488,2.602,1.488h2.116 c0.95,0,2.115-0.672,2.591-1.496l1.056-1.826c0.474-0.822,0.474-2.166-0.002-2.99l-1.052-1.812c-0.477-0.824-0.477-2.166,0-2.988 l1.051-1.809c0.477-0.822,0.477-2.166,0-2.988L240.405,206.092z"/> </g> <g class="states-polygon" id="g_30"> <path class="path_estado" id="est_30" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M282.1,220.566c-0.481-0.82-1.653-1.49-2.603-1.49h-2.094 c-0.95,0-2.104-0.68-2.565-1.51l-1.106-1.992c-0.462-0.83-1.616-1.51-2.566-1.51h-2.11c-0.949,0-2.121-0.67-2.603-1.488 l-1.034-1.758c-0.48-0.818-1.651-1.486-2.602-1.486h-2.094c-0.948,0-2.119-0.672-2.603-1.49l-1.032-1.756 c-0.482-0.82-1.653-1.488-2.603-1.488h-2.109c-0.95,0-2.118-0.672-2.594-1.494l-1.051-1.801c-0.477-0.822-0.48-2.168-0.007-2.99 l1.064-1.852c0.472-0.824,0.472-2.172,0-2.992l-1.064-1.852c-0.474-0.824-1.637-1.498-2.587-1.498h-2.094 c-0.95,0-2.122-0.67-2.603-1.488l-1.032-1.756c-0.481-0.818-0.481-2.16,0-2.977l1.032-1.757c0.48-0.82,0.48-2.158,0-2.979 l-1.032-1.756c-0.481-0.818-1.653-1.488-2.603-1.488h-2.11c-0.949,0-2.12-0.67-2.602-1.488l-1.034-1.756 c-0.482-0.82-1.653-1.488-2.602-1.488h-2.117c-0.948,0-2.119,0.668-2.603,1.488l-1.032,1.756c-0.482,0.818-0.482,2.158,0,2.977 l1.032,1.756c0.483,0.82,1.654,1.49,2.603,1.49h2.11c0.95,0,2.117,0.67,2.596,1.492l1.048,1.804c0.478,0.82,0.48,2.166,0.008,2.99 l-1.062,1.852c-0.474,0.822-0.474,2.17,0,2.992l1.062,1.85c0.473,0.824,1.638,1.498,2.587,1.498h2.094 c0.95,0,2.122,0.668,2.603,1.488l1.033,1.758c0.483,0.818,0.484,2.16,0.004,2.979l-1.041,1.779c-0.48,0.82-0.48,2.164-0.001,2.982 l1.045,1.791c0.478,0.822,0.48,2.166,0.009,2.988l-1.064,1.846c-0.472,0.822-0.472,2.172,0,2.992l1.064,1.846 c0.472,0.824,1.637,1.496,2.587,1.496h2.115c0.95,0,2.104-0.68,2.564-1.51l1.108-1.992c0.461-0.83,1.615-1.51,2.565-1.51h2.087 c0.95,0,2.115,0.672,2.587,1.496l1.064,1.852c0.474,0.824,0.472,2.172-0.003,2.992l-1.057,1.826c-0.475,0.822-0.475,2.168,0,2.99 l1.057,1.828c0.475,0.82,1.64,1.494,2.591,1.494h2.11c0.949,0,2.121,0.67,2.602,1.486l1.034,1.76c0.48,0.818,1.651,1.486,2.6,1.486 h2.117c0.95,0,2.12-0.668,2.603-1.486l1.034-1.76c0.48-0.816,1.651-1.486,2.602-1.486h2.094c0.949,0,2.121-0.67,2.603-1.488 l1.032-1.756c0.48-0.82,0.48-2.158,0-2.977L282.1,220.566z"/> </g> <g class="states-polygon" id="g_20"> <path class="path_estado" id="est_20" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M283.142,234.826c0.478-0.822,0.475-2.166-0.002-2.988 l-1.049-1.801c-0.477-0.822-1.645-1.494-2.594-1.494h-2.116c-0.949,0-2.12,0.67-2.602,1.486l-1.033,1.76 c-0.482,0.818-1.653,1.486-2.603,1.486h-2.089c-0.949,0-2.121-0.668-2.603-1.486l-1.034-1.76c-0.48-0.816-1.651-1.486-2.602-1.486 h-2.094c-0.948,0-2.116-0.674-2.594-1.492l-1.049-1.805c-0.477-0.82-0.48-2.166-0.007-2.988l1.062-1.852 c0.474-0.822,0.474-2.17,0-2.994l-1.062-1.852c-0.474-0.824-1.639-1.496-2.588-1.496h-2.114c-0.95,0-2.104,0.68-2.565,1.51 l-1.108,1.992c-0.461,0.83-1.614,1.51-2.563,1.51h-2.111c-0.95,0-2.119,0.67-2.603,1.49l-1.033,1.756 c-0.48,0.818-1.652,1.488-2.603,1.488h-2.094c-0.949,0-2.117,0.67-2.598,1.49l-1.04,1.779c-0.48,0.82-0.48,2.162-0.004,2.982 l1.046,1.793c0.479,0.82,0.479,2.162,0.001,2.984l-1.047,1.797c-0.477,0.82-0.477,2.164-0.001,2.984l1.048,1.801 c0.478,0.82,0.478,2.164,0,2.984l-1.048,1.803c-0.476,0.822-0.476,2.164,0,2.984l1.048,1.801c0.478,0.822,1.646,1.494,2.595,1.494 h2.116c0.949,0,2.121-0.67,2.603-1.488l1.032-1.758c0.48-0.818,1.652-1.486,2.603-1.486h2.09c0.949,0,2.12,0.668,2.602,1.486 L249.77,251c0.479,0.818,1.651,1.488,2.602,1.488h2.114c0.949,0,2.12-0.67,2.603-1.488l1.032-1.758 c0.483-0.818,1.654-1.486,2.603-1.486h2.094c0.95,0,2.121-0.67,2.602-1.488l1.034-1.758c0.481-0.818,1.653-1.488,2.603-1.488h2.089 c0.949,0,2.12,0.67,2.603,1.488l1.033,1.758c0.481,0.818,1.652,1.488,2.602,1.488h2.116c0.949,0,2.114-0.674,2.59-1.496 l1.057-1.826c0.476-0.822,0.476-2.168-0.002-2.988l-1.053-1.818c-0.475-0.818-0.475-2.164,0-2.984L283.142,234.826z"/> </g> <g class="states-polygon" id="g_27"> <path class="path_estado" id="est_27" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M307.107,215.564c-0.472-0.824-1.634-1.5-2.582-1.5h-2.118 c-0.95,0-2.104,0.68-2.563,1.51l-1.108,1.992c-0.459,0.83-1.613,1.51-2.565,1.51h-2.109c-0.95,0-2.121,0.67-2.602,1.49 l-1.033,1.756c-0.481,0.818-1.652,1.488-2.604,1.488h-2.092c-0.949,0-2.121,0.668-2.604,1.488l-1.032,1.756 c-0.483,0.818-0.483,2.158,0,2.975l1.032,1.76c0.482,0.818,1.654,1.486,2.604,1.486h2.113c0.95,0,2.122-0.668,2.603-1.486 l1.034-1.76c0.48-0.816,1.651-1.486,2.601-1.486h2.095c0.949,0,2.119-0.67,2.603-1.488l1.034-1.756 c0.48-0.82,1.651-1.488,2.602-1.488h2.111c0.948,0,2.11-0.676,2.582-1.498l1.069-1.877c0.473-0.824,0.473-2.174,0-2.998 L307.107,215.564z"/> </g> <g class="states-polygon" id="g_07"> <path class="path_estado" id="est_07" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M323.786,234.775c-0.471-0.824-1.633-1.5-2.585-1.5h-2.108 c-0.948,0-2.119-0.672-2.598-1.49l-1.04-1.779c-0.48-0.82-0.479-2.16,0.004-2.977l1.029-1.746c0.483-0.818,0.483-2.156,0-2.973 l-1.029-1.746c-0.483-0.818-1.654-1.488-2.604-1.488h-2.116c-0.949,0-2.119,0.67-2.602,1.49l-1.033,1.756 c-0.482,0.818-1.652,1.488-2.602,1.488h-2.096c-0.95,0-2.119,0.668-2.602,1.488l-1.034,1.756c-0.48,0.818-1.649,1.488-2.602,1.488 h-2.109c-0.95,0-2.121,0.67-2.602,1.486l-1.033,1.76c-0.481,0.818-1.652,1.486-2.604,1.486h-2.092 c-0.949,0-2.118,0.674-2.592,1.496l-1.056,1.828c-0.478,0.822-0.475,2.166,0.001,2.988l1.052,1.814 c0.477,0.822,0.477,2.166,0,2.988l-1.052,1.811c-0.476,0.818-0.476,2.164,0,2.982l1.052,1.811c0.477,0.822,1.646,1.494,2.595,1.494 h2.092c0.951,0,2.122,0.67,2.604,1.488l1.033,1.758c0.48,0.818,1.651,1.486,2.602,1.486h2.109c0.952,0,2.121,0.672,2.602,1.49 l1.034,1.756c0.482,0.82,1.651,1.488,2.602,1.488h2.118c0.948,0,2.119-0.668,2.6-1.488l1.035-1.756 c0.481-0.818,0.481-2.158,0-2.977l-1.035-1.758c-0.48-0.818-0.48-2.158,0-2.977l1.035-1.758c0.481-0.818,1.652-1.486,2.601-1.486 h2.095c0.949,0,2.12-0.67,2.603-1.488l1.033-1.758c0.482-0.818,1.653-1.488,2.602-1.488h2.108c0.952,0,2.114-0.674,2.585-1.5 l1.073-1.873c0.47-0.824,0.47-2.174,0-3L323.786,234.775z"/> </g> <g class="states-polygon" id="g_04"> <path class="path_estado" id="est_04" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M340.477,206.092c-0.477-0.822-0.474-2.164,0.008-2.982 l1.033-1.756c0.483-0.82,0.483-2.158,0-2.977l-1.033-1.758c-0.481-0.82-1.652-1.488-2.602-1.488h-2.111 c-0.948,0-2.104-0.68-2.563-1.508l-1.107-1.994c-0.461-0.832-1.614-1.51-2.566-1.51h-2.094c-0.95,0-2.121-0.67-2.601-1.488 l-1.033-1.758c-0.482-0.816-1.653-1.486-2.605-1.486h-2.113c-0.948,0-2.114,0.672-2.592,1.494l-1.056,1.826 c-0.474,0.824-0.474,2.168,0.004,2.988l1.051,1.816c0.477,0.822,0.477,2.166,0,2.986l-1.051,1.811 c-0.478,0.822-0.475,2.164,0.004,2.984l1.04,1.783c0.48,0.82,0.48,2.162,0,2.982l-1.04,1.781c-0.479,0.82-1.649,1.492-2.598,1.492 h-2.111c-0.949,0-2.11,0.674-2.582,1.498l-1.071,1.873c-0.472,0.826-0.472,2.174,0,3l1.071,1.875 c0.472,0.822,1.633,1.498,2.582,1.498h2.111c0.948,0,2.119,0.67,2.602,1.49l1.033,1.756c0.482,0.818,1.654,1.488,2.603,1.488h2.113 c0.952,0,2.123-0.67,2.605-1.488l1.033-1.756c0.479-0.82,1.65-1.49,2.601-1.49h2.091c0.948,0,2.119,0.67,2.6,1.49l1.035,1.756 c0.479,0.818,1.653,1.488,2.602,1.488h2.115c0.949,0,2.117-0.672,2.591-1.496l1.056-1.826c0.477-0.822,0.474-2.166-0.002-2.99 l-1.052-1.812c-0.476-0.824-0.476-2.166,0.001-2.988l1.051-1.809c0.476-0.822,0.476-2.166,0-2.988L340.477,206.092z"/> </g> <g class="states-polygon" id="g_31"> <path class="path_estado" id="est_31" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M357.146,167.673c-0.474-0.824-1.635-1.498-2.584-1.498h-2.116 c-0.949,0-2.104,0.678-2.565,1.508l-1.107,1.994c-0.461,0.83-1.615,1.51-2.565,1.51h-2.111c-0.948,0-2.119,0.668-2.602,1.488 l-1.033,1.756c-0.479,0.818-1.65,1.488-2.602,1.488h-2.093c-0.948,0-2.122,0.67-2.602,1.488l-1.035,1.756 c-0.48,0.82-1.651,1.49-2.6,1.49h-2.11c-0.951,0-2.122,0.668-2.603,1.488l-1.034,1.755c-0.482,0.818-0.482,2.16,0,2.977 l1.034,1.758c0.48,0.818,1.651,1.488,2.603,1.488h2.11c0.948,0,2.104,0.678,2.565,1.51l1.105,1.994 c0.461,0.828,1.617,1.508,2.565,1.508h2.115c0.949,0,2.103-0.68,2.565-1.508l1.106-1.994c0.462-0.832,1.615-1.51,2.566-1.51h2.093 c0.948,0,2.12-0.67,2.603-1.488l1.034-1.756c0.481-0.818,0.481-2.16,0-2.977l-1.034-1.757c-0.482-0.82-0.482-2.158,0-2.979 l1.034-1.756c0.481-0.818,1.652-1.488,2.601-1.488h2.111c0.949,0,2.11-0.674,2.584-1.498l1.07-1.875 c0.472-0.824,0.472-2.174,0-2.998L357.146,167.673z"/> </g> <g class="states-polygon" id="g_23"> <path class="path_estado" id="est_23" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M357.157,186.936c-0.479-0.822-0.477-2.164,0.004-2.984l1.04-1.78 c0.479-0.82,0.479-2.162,0-2.98l-1.04-1.781c-0.48-0.82-1.649-1.49-2.599-1.49h-2.116c-0.949,0-2.117,0.67-2.598,1.49l-1.041,1.781 c-0.48,0.818-0.478,2.16,0.005,2.977l1.03,1.747c0.481,0.816,0.481,2.154,0,2.973l-1.03,1.746 c-0.482,0.816-1.654,1.486-2.604,1.486h-2.111c-0.948,0-2.11,0.674-2.585,1.498l-1.063,1.852c-0.475,0.82-0.471,2.168,0.003,2.99 l1.058,1.826c0.475,0.822,0.473,2.168-0.005,2.988l-1.047,1.791c-0.479,0.82-0.479,2.164,0,2.982l1.047,1.793 c0.478,0.82,1.645,1.492,2.593,1.492h2.111c0.95,0,2.121,0.668,2.604,1.486l1.032,1.758c0.481,0.818,1.653,1.488,2.603,1.488h2.116 c0.949,0,2.12-0.67,2.602-1.488l1.033-1.756c0.482-0.82,0.482-2.16,0.004-2.98l-1.04-1.779c-0.48-0.82-0.48-2.162-0.002-2.982 l1.045-1.791c0.478-0.82,0.478-2.162,0-2.984l-1.047-1.797c-0.479-0.822-0.479-2.164,0-2.986l1.049-1.801 c0.476-0.818,0.476-2.162,0-2.982L357.157,186.936z"/> </g> <g class="states-polygon" id="g_12"> <path class="path_estado" id="est_12" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M232.053,230.037c-0.478-0.822-0.475-2.162,0.008-2.982 l1.034-1.756c0.481-0.82,0.481-2.158,0-2.977l-1.034-1.756c-0.482-0.82-1.653-1.49-2.602-1.49h-2.094 c-0.95,0-2.122,0.67-2.604,1.49l-1.032,1.756c-0.482,0.818-1.653,1.488-2.603,1.488h-2.115c-0.95,0-2.121-0.67-2.602-1.488 l-1.034-1.756c-0.48-0.82-1.652-1.49-2.603-1.49h-2.089c-0.95,0-2.104-0.68-2.563-1.51l-1.109-1.992 c-0.459-0.83-1.614-1.51-2.565-1.51h-2.114c-0.949,0-2.104,0.68-2.565,1.51l-1.107,1.992c-0.46,0.83-1.616,1.51-2.564,1.51h-2.11 c-0.949,0-2.121,0.67-2.603,1.49l-1.032,1.756c-0.483,0.818-0.483,2.156,0,2.977l1.032,1.756c0.481,0.818,1.653,1.488,2.603,1.488 h2.11c0.948,0,2.12,0.67,2.603,1.486l1.033,1.76c0.482,0.818,1.652,1.486,2.602,1.486h2.095c0.95,0,2.119,0.672,2.603,1.488 l1.033,1.758c0.48,0.82,1.65,1.488,2.603,1.488h2.108c0.95,0,2.105,0.678,2.564,1.508l1.108,1.996 c0.461,0.828,1.615,1.508,2.565,1.508h2.093c0.951,0,2.12,0.67,2.603,1.488l1.032,1.758c0.483,0.818,1.654,1.488,2.603,1.488h2.117 c0.948,0,2.115-0.674,2.59-1.496l1.056-1.826c0.476-0.822,0.476-2.168-0.001-2.988l-1.051-1.816c-0.478-0.82-0.478-2.166,0-2.986 l1.049-1.809c0.479-0.822,0.479-2.166,0-2.988L232.053,230.037z"/> </g> <g class="states-polygon" id="g_17"> <path fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M219.012,223.811c-0.95,0-2.121-0.67-2.602-1.488l-1.034-1.756 c-0.48-0.82-0.48-2.16,0-2.979l1.034-1.756c0.48-0.82,1.651-1.488,2.602-1.488h2.115c0.949,0,2.12,0.668,2.603,1.488l1.032,1.756 c0.481,0.818,0.481,2.158,0,2.979l-1.032,1.756c-0.482,0.818-1.653,1.488-2.603,1.488H219.012z"/> <path class="path_estado" id="est_17" fill="#F0F0F1" stroke="#353535" stroke-miterlimit="10" d="M219.012,223.811c-0.95,0-2.121-0.67-2.602-1.488l-1.034-1.756 c-0.48-0.82-0.48-2.16,0-2.979l1.034-1.756c0.48-0.82,1.651-1.488,2.602-1.488h2.115c0.949,0,2.12,0.668,2.603,1.488l1.032,1.756 c0.481,0.818,0.481,2.158,0,2.979l-1.032,1.756c-0.482,0.818-1.653,1.488-2.603,1.488H219.012z"/> </g> </g> </svg>';


  function MexicoMapRounded(mapConfig,circlesConfig,tipConfig,callbackConfig) {

    this._mapConfig = mapConfig;
    /*mapConfig
    target: 'ID string',
    identifierKey: string
    zoom:{
      available: bool,
      zoomRange: array of two numbers
    }*/

    this._circlesConfig = circlesConfig;

    /*circlesConfig
    minPadding: number
    radius: number
    style:{
      fill: string
      strokeColor: string
      strokeWidth: number
    }*/

    this._tipConfig = (tipConfig) ? tipConfig : {};

    /*tipConfig
    classes: string
    html: string*/

    if(callbackConfig){
      this._callbackClick = callbackConfig.click ? callbackConfig.click : null;
      this._callbackOver = callbackConfig.over ? callbackConfig.over : null;
      this._callbackOut = callbackConfig.out ? callbackConfig.out : null;
    }

    /*
      callbackConfig
      click
      over
      out
    */

    //this._mapLayer = d3.select(this._mapConfig.target);

    this._tip = d3.tip();

    if(tipConfig){
      this._tip.attr('class', 'd3-tip ' + tipConfig.classes).html(tipConfig.html);
    }else{
      this._tip.attr('class', 'd3-tip').html("<span>I'm a Tip</span>");
    }

    var self = this;

    this._zoom = d3.zoom().scaleExtent(this._mapConfig.zoom.zoomRange).on("zoom",function(){
      self.zoomed();
    });

  }

  MexicoMapRounded.prototype.bindTo = function(target){
    this._targetBind = target;
    return this;
  };

  MexicoMapRounded.prototype.zoomed = function(){
    this._tip.hide();
    this._mapLayer.attr("transform", d3.event.transform);
  };

  MexicoMapRounded.prototype.drawMap = function(data) {

    d3.select(this._targetBind).append('div').html(testMap);

    this._mapLayer = d3.select(this._mapConfig.target);

    this._mapLayer.call(this._zoom);
    this._mapLayer.call(this._tip);

    var self = this;

    this._data = d3.nest()
                    .key(function(d) { return d[self._mapConfig.identifierKey]; })
                    .entries(data);

    this._data.forEach(function(obj,idx){

      dataStateLength = obj.values.length;
      obj.values.forEach(function(item,index){

        self.drawCircle(item,index);

      });

    });

    return this;

  };


  MexicoMapRounded.prototype.drawCircle = function(item,index){

    var bbox,center;

    var max,min = (this._circlesConfig.minPadding) ? this._circlesConfig.minPadding : 5;
    var paddingX, paddingY,centerX,centerY;

    bbox = d3.select("#est_"+item[this._mapConfig.identifierKey]).node().getBBox();

    max = bbox.width;

    paddingX = (dataStateLength > 1) ? Math.floor(Math.random()*(max-min+1) + min)/4 : 0;

    max = bbox.height;

    paddingY = (dataStateLength > 1) ? Math.floor(Math.random()*(max-min+1) + min)/4 : 0;

    centerY = (bbox.y + bbox.height/2);
    centerX = (bbox.x + bbox.width/2);

    var self = this;

    // Click on state path
    d3.select("#est_"+item[this._mapConfig.identifierKey]).on('click',function(){
        self.triggerClick(item);
      });

    if(+item.dispensa){
      this._mapLayer.append("circle")
        .attr("cx",centerX + paddingX)
        .attr("cy",centerY + paddingY)
        .attr("r",(self._circlesConfig.radius) ? self._circlesConfig.radius : 2.5)
        .attr("class","circle-map-rounded")
        .style("fill",self._circlesConfig.style.fill)
        .style('stroke', self._circlesConfig.style.strokeColor)
        .style('stroke-width',self._circlesConfig.style.strokeWidth + "px")
        .on('click',function(){
          self.triggerClick(item);
        })
        .on('mouseover',function(){
          self.triggerOver(item);
        })
        .on('mouseout',function(){
          self.triggerOut(item);
        });
    }


  };

  MexicoMapRounded.prototype.triggerClick = function(item){
    if(this._callbackClick){
      this._callbackClick(item);
    }
  };

  MexicoMapRounded.prototype.triggerOver = function(item){

    this._tip.show(item);
    if(this._callbackOver){
      this._callbackOver(item);
    }
  };

  MexicoMapRounded.prototype.triggerOut = function(item){
    this._tip.hide();
    if(this._callbackOut){
      this._callbackOut(item);
    }
  };

  MexicoMapRounded.prototype.setTipHtml = function(content){
    this._tip.html(content);
  };

  MexicoMapRounded.prototype.colorStates = function(domain,range,fillCallback){

    var testScale = d3.scaleQuantile()
      .domain(domain)
      .range(range);

    var self = this;

    d3.selectAll(".path_estado").style("fill",function(){
      return fillCallback(self,this,testScale);
    });

    return this;
  };

  return new MexicoMapRounded(config.mapConfig,config.circlesConfig,config.tipConfig,config.callbackConfig);
};

exports.chart = chart;
exports.scatter = scatter;
exports.timeline = timeline;
exports.heatmap = heatmap;
exports.treemap = treemap;
exports.MexicoMapRounded = mexicoMapRounded;

Object.defineProperty(exports, '__esModule', { value: true });

})));