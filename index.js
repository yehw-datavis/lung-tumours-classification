const width = document.body.clientWidth;
const height = document.body.clientHeight;

const margin = { top: 10, right: 200, bottom: 120, left: 50 };
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

const dx = 20;
const dy = innerWidth / 5;

const dataviz = d3
  .select("#dataviz")
  .attr("style", "border: thin solid lightblue");

const svg = dataviz
  .append("svg")
  .attr("viewBox", [-margin.left, -margin.top, width, dx])
  .style("font", "10px sans-serif")
  .style("user-select", "none");

const gLink = svg
  .append("g")
  .attr("fill", "none")
  .attr("stroke", "#555")
  .attr("stroke-opacity", 0.4)
  .attr("stroke-width", 1.5);

const gNode = svg
  .append("g")
  .attr("cursor", "pointer")
  .attr("pointer-events", "all");

const tree = d3.tree().nodeSize([dx, dy]);

const diagonal = d3
  .linkHorizontal()
  .x((d) => d.y)
  .y((d) => d.x);

// create a tooltip
const tooltip = d3
  .select("#dataviz")
  .append("div")
  .attr("class", "tooltip")
  .style("display", "inline")
  .style("position", "fixed")
  .style("opacity", 0)
  .style("background-color", "white")
  .style("border", "solid")
  .style("border-width", "1px")
  .style("border-radius", "5px")
  .style("padding", "10px");

const mouseover = function (d) {
  tooltip.style("opacity", 1);
  d3.select(this)
    .selectAll("text")
    .style("font-size", "200%")
    .style("fill", "firebrick")
    .text((d) => d.data.name);
};

const mouseleave = function (d) {
  tooltip.style("opacity", 0);
  tooltip.style("top", "0px").style("left", "0px");
  d3.select(this)
    .selectAll("text")
    .style("font-size", "medium")
    .style("fill", (d) => (d.data.attr.NSCLC ? "navy" : "black"))
    .text((d) =>
      d.depth > 3 || d.data.name.length < 25
        ? d.data.name
        : `${d.data.name.substring(0, 21)}...`
    );
};

const mousemove = function (e, d) {
  var nsclcDescription = d.data.attr.NSCLC ? `<br><i>NSCLC</i>` : "";
  tooltip
    .style("top", `${e.pageY + 20 - window.scrollY}px`)
    .style("left", `${e.pageX + 20}px`)
    .html(
      `<b>id</b>: ${d.id} (<i>${d.data.attr.class}</i>)<br><b>name</b>: ${d.data.name}<br>Morphology code: ${d.data.attr.morphology_code}<br>Topography code: ${d.data.attr.topography_code}${nsclcDescription}`
    );
};

d3.json("./graph.json").then((data) => {
  const root = d3.hierarchy(data);

  root.x0 = dy / 2;
  root.y0 = 0;
  root.descendants().forEach((d, i) => {
    d.id = d.data.id;
    d._children = d.children;
  });

  function update(source) {
    const duration = d3.event && d3.event.altKey ? 2500 : 250;
    const nodes = root.descendants().reverse();
    const links = root.links();

    // Compute the new tree layout.
    tree(root);

    var left = root;
    var right = root;
    root.eachBefore((node) => {
      if (node.x < left.x) left = node;
      if (node.x > right.x) right = node;
    });

    const height = right.x - left.x + margin.top + margin.bottom;

    const transition = svg
      .transition()
      .duration(duration)
      .attr("viewBox", [-margin.left, left.x - margin.top, width, height])
      .tween(
        "resize",
        window.ResizeObserver ? null : () => () => svg.dispatch("toggle")
      );

    // Update the nodes…
    const node = gNode.selectAll("g").data(nodes, (d) => d.id);

    // Enter any new nodes at the parent's previous position.
    const nodeEnter = node
      .enter()
      .append("g")
      .attr("transform", (d) => `translate(${source.y0},${source.x0})`)
      .attr("fill-opacity", 0)
      .attr("stroke-opacity", 0)
      .on("click", (event, d) => {
        d.children = d.children ? null : d._children;
        update(d);
      });

    nodeEnter
      .append("circle")
      .attr("r", 4)
      .attr("fill", (d) => (d._children ? "#555" : "#999"))
      .attr("stroke-width", 10);

    nodeEnter
      .append("text")
      .attr("dy", "0.31em")
      .attr("x", (d) => (d._children ? -6 : 6))
      .attr("text-anchor", (d) => (d._children ? "end" : "start"))
      .text((d) =>
        d.depth > 3 || d.data.name.length < 25
          ? d.data.name
          : `${d.data.name.substring(0, 21)}...`
      )
      .style("font-style", (d) =>
        d.data.attr.morphology_code ? "normal" : "italic"
      )
      .style("font-size", "medium")
      .style("fill", (d) => (d.data.attr.NSCLC ? "navy" : "black"))
      .clone(true)
      .lower()
      .attr("stroke-linejoin", "round")
      .attr("stroke-width", 4)
      .attr("stroke", "white");

    nodeEnter
      .on("mouseover", mouseover)
      .on("mousemove", mousemove)
      .on("mouseleave", mouseleave);

    // Transition nodes to their new position.
    const nodeUpdate = node
      .merge(nodeEnter)
      .transition(transition)
      .attr("transform", (d) => `translate(${d.y},${d.x})`)
      .attr("fill-opacity", 1)
      .attr("stroke-opacity", 1);

    // Transition exiting nodes to the parent's new position.
    const nodeExit = node
      .exit()
      .transition(transition)
      .remove()
      .attr("transform", (d) => `translate(${source.y},${source.x})`)
      .attr("fill-opacity", 0)
      .attr("stroke-opacity", 0);

    // Update the links…
    const link = gLink.selectAll("path").data(links, (d) => d.target.id);

    // Enter any new links at the parent's previous position.
    const linkEnter = link
      .enter()
      .append("path")
      .attr("d", (d) => {
        const o = { x: source.x0, y: source.y0 };
        return diagonal({ source: o, target: o });
      });

    // Transition links to their new position.
    link.merge(linkEnter).transition(transition).attr("d", diagonal);

    // Transition exiting nodes to the parent's new position.
    link
      .exit()
      .transition(transition)
      .remove()
      .attr("d", (d) => {
        const o = { x: source.x, y: source.y };
        return diagonal({ source: o, target: o });
      });

    // Stash the old positions for transition.
    root.eachBefore((d) => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }

  update(root);

  return svg.node();
});
