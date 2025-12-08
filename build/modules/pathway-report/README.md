# Pathways Module for Metabolomics Pipeline

This project generates an HTML fragment that implements a
pathway visualization module for an omic data reporting
pipeline.  Briefly, the generated HTML:
- Uses the [SBNGViz](https://pubmed.ncbi.nlm.nih.gov/26030594/) visualization tool to show zoomable and pannable pathway diagrams from our [pathway diagrams database](https://github.com/MD-Anderson-Bioinformatics/pathway-diagrams),
- Can overlay data from the experiment onto the corresponding nodes within the pathway diagrams, and
- Allows the user to summarize data by category.

Currently, this project is only used by, and only useable by,
[xPEDITE](https://github.com/MD-Anderson-Bioinformatics/xPEDITE).

