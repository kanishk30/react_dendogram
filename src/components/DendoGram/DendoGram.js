import React, { Component } from "react";
import "./DendoGram.css";
import { max, select, layout, svg, event, behavior } from "d3";

class DendoGram extends Component {
  constructor(props) {
    super(props);
    this.createDendoGram = this.createDendoGram.bind(this);
  }
  componentDidMount() {
    this.createDendoGram();
  }
  componentDidUpdate() {
    this.createDendoGram();
  }
  createDendoGram() {
    let mainNode = this.mainNode;
    // Calculate total nodes, max label length
    let totalNodes = 0;
    let maxLabelLength = 0;

    let i = 0;
    let duration = 750;
    let root;
    let scale, selectedNode;

    // size of the diagram
    let viewerWidth = this.props.width;
    let viewerHeight = this.props.height;

    let tree = layout.tree().size([viewerHeight, viewerWidth]);

    // define a d3 diagonal projection for use by the node paths later on.

    let diagonal = svg.diagonal().projection(function(d) {
      return [d.y, d.x];
    });

    // A recursive helper function for performing some setup by walking through all nodes

    function visit(parent, visitFn, childrenFn) {
      if (!parent) return;

      visitFn(parent);

      let children = childrenFn(parent);
      if (children) {
        let count = children.length;
        for (let i = 0; i < count; i++) {
          visit(children[i], visitFn, childrenFn);
        }
      }
    }

    // Call visit function to establish maxLabelLength
    visit(
      this.props.data,
      function(d) {
        totalNodes++;
        maxLabelLength = Math.max(d.name.length, maxLabelLength);
      },
      function(d) {
        return d.children && d.children.length > 0 ? d.children : null;
      }
    );

    // sort the tree according to the node names

    function sortTree() {
      tree.sort(function(a, b) {
        return b.name.toLowerCase() < a.name.toLowerCase() ? 1 : -1;
      });
    }
    // Sort the tree initially incase the JSON isn't in a sorted order.
    sortTree();

    // Define the zoom function for the zoomable tree

    function zoom() {
      svgGroup.attr(
        "transform",
        "translate(" + event.translate + ")scale(" + event.scale + ")"
      );
    }

    // define the zoomListener which calls the zoom function on the "zoom" event constrained within the scaleExtents
    let zoomListener = behavior
      .zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", zoom);

    // define the baseSvg, attaching a class for styling and the zoomListener
    let baseSvg = select(mainNode)
      .append("svg")
      .attr("width", viewerWidth)
      .attr("height", viewerHeight)
      .attr("class", "overlay")
      .call(zoomListener);

    let overCircle = function(d) {
      selectedNode = d;
    };
    let outCircle = function(d) {
      selectedNode = null;
    };

    // Function to center node when clicked/dropped so node doesn't get lost when collapsing/moving with large amount of children.

    function centerNode(source) {
      scale = zoomListener.scale();
      let x = -source.y0;
      let y = -source.x0;
      x = x * scale + viewerWidth / 4;
      y = y * scale + viewerHeight / 4;
      select("g")
        .transition()
        .duration(duration)
        .attr(
          "transform",
          "translate(" + x + "," + y + ")scale(" + scale + ")"
        );
      zoomListener.scale(scale);
      zoomListener.translate([x, y]);
    }

    // Toggle children function

    function toggleChildren(d) {
      if (d.children) {
        d._children = d.children;
        d.children = null;
      } else if (d._children) {
        d.children = d._children;
        d._children = null;
      }
      return d;
    }

    // Toggle children on click.

    function click(d) {
      if (event.defaultPrevented) return; // click suppressed
      d = toggleChildren(d);
      update(d);
      centerNode(d);
    }

    function update(source) {
      // Compute the new height, function counts total children of root node and sets tree height accordingly.
      // This prevents the layout looking squashed when new nodes are made visible or looking sparse when nodes are removed
      // This makes the layout more consistent.
      let levelWidth = [1];
      let childCount = function(level, n) {
        if (n.children && n.children.length > 0) {
          if (levelWidth.length <= level + 1) levelWidth.push(0);

          levelWidth[level + 1] += n.children.length;
          n.children.forEach(function(d) {
            childCount(level + 1, d);
          });
        }
      };
      childCount(0, root);
      let newHeight = max(levelWidth) * 150; // vertical spacing between the levels
      tree = tree.size([newHeight, viewerWidth]);

      // Compute the new tree layout.
      let nodes = tree.nodes(root).reverse(),
        links = tree.links(nodes);

      // Set widths between levels based on maxLabelLength.
      nodes.forEach(function(d) {
        d.y = d.depth * (maxLabelLength * 10); //horizontal  spacing between the levels
        // alternatively to keep a fixed scale one can set a fixed depth per level
        // Normalize for fixed-depth by commenting out below line
        // d.y = (d.depth * 500); //500px per level.
      });

      // Update the nodes…
      let node = svgGroup.selectAll("g.node").data(nodes, function(d) {
        return d.id || (d.id = ++i);
      });

      // Enter any new nodes at the parent's previous position.
      let nodeEnter = node
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", function(d) {
          return "translate(" + source.y0 + "," + source.x0 + ")";
        })
        .on("click", click);

      nodeEnter
        .append("circle")
        .attr("class", "nodeCircle")
        .attr("r", 0)
        .style("fill", function(d) {
          return d._children ? "lightsteelblue" : "#fff";
        });

      nodeEnter
        .append("text")
        .attr("x", function(d) {
          return d.children || d._children ? -10 : -10;
        })
        .attr("dy", ".35em")
        .attr("class", "nodeText")
        .attr("text-anchor", function(d) {
          return d.children || d._children ? "end" : "start";
        })
        .text(function(d) {
          return d.name;
        })
        .style("fill-opacity", 0);

      // phantom node to give us mouseover in a radius around it
      nodeEnter
        .append("circle")
        .attr("class", "ghostCircle")
        .attr("r", 30)
        .attr("opacity", 0.2) // change this to zero to hide the target area
        .style("fill", "red")
        .attr("pointer-events", "mouseover")
        .on("mouseover", function(node) {
          overCircle(node);
        })
        .on("mouseout", function(node) {
          outCircle(node);
        });

      // Update the text to reflect whether node has children or not.
      node
        .select("text")
        .attr("x", function(d) {
          return d.children || d._children ? -20 : -20;
        })
        .attr("y", function(d) {
          return d.children || d._children ? 0 : 0;
        })
        .attr("text-anchor", function(d) {
          return d.children || d._children ? "end" : "end";
        })
        .text(function(d) {
          return d.name;
        });

      // Change the circle fill depending on whether it has children and is collapsed
      node
        .select("circle.nodeCircle")
        .attr("r", 10)
        .style("fill", function(d) {
          return d._children ? "lightsteelblue" : "#fff";
        });

      // Transition nodes to their new position.
      let nodeUpdate = node
        .transition()
        .duration(duration)
        .attr("transform", function(d) {
          return "translate(" + d.y + "," + d.x + ")";
        });

      // Fade the text in
      nodeUpdate.select("text").style("fill-opacity", 1);

      // Transition exiting nodes to the parent's new position.
      let nodeExit = node
        .exit()
        .transition()
        .duration(duration)
        .attr("transform", function(d) {
          return "translate(" + source.y + "," + source.x + ")";
        })
        .remove();

      nodeExit.select("circle").attr("r", 0);

      nodeExit.select("text").style("fill-opacity", 0);

      // Update the links…
      let link = svgGroup.selectAll("path.link").data(links, function(d) {
        return d.target.id;
      });

      // Enter any new links at the parent's previous position.
      link
        .enter()
        .insert("path", "g")
        .attr("class", "link")
        .attr("d", function(d) {
          let o = {
            x: source.x0,
            y: source.y0
          };
          return diagonal({
            source: o,
            target: o
          });
        });

      // Transition links to their new position.
      link
        .transition()
        .duration(duration)
        .attr("d", diagonal);

      // Transition exiting nodes to the parent's new position.
      link
        .exit()
        .transition()
        .duration(duration)
        .attr("d", function(d) {
          let o = {
            x: source.x,
            y: source.y
          };
          return diagonal({
            source: o,
            target: o
          });
        })
        .remove();

      // Stash the old positions for transition.
      nodes.forEach(function(d) {
        d.x0 = d.x;
        d.y0 = d.y;
      });
    }

    // Append a group which holds all nodes and which the zoom Listener can act upon.
    let svgGroup = baseSvg.append("g");

    // Define the root
    root = this.props.data;
    root.x0 = viewerHeight / 2;
    root.y0 = 0;

    // Layout the tree initially and center on the root node.
    update(root);
    centerNode(root);

    let couplingParent1 = tree.nodes(root).filter(function(d) {
      return d["name"] === "Neuro-like networks";
    })[0];
    let couplingChild1 = tree.nodes(root).filter(function(d) {
      return d["name"] === "Heuristic modeling";
    })[0];

    let multiParents = [
      {
        parent: couplingParent1,
        child: couplingChild1
      }
    ];

    multiParents.forEach(function(multiPair) {
      svgGroup
        .append("path", "g")
        .attr("class", "additionalParentLink")
        .attr("d", function() {
          let oTarget = {
            x: multiPair.parent.x0 ,
            y: multiPair.parent.y0 + 10
          };
          let oSource = {
            x: multiPair.child.x0,
            y: multiPair.child.y0 
          };
          return diagonal({
            source: oSource,
            target: oTarget
          });
        });
    });
  }
  render() {
    return <div ref={mainNode => (this.mainNode = mainNode)} />;
  }
}
export default DendoGram;
