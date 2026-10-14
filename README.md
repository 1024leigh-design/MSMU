# MicroLab

Interactive review site for BIO 3L General Microbiology Lab (midterm review, Exercises 1 through 17).

- `index.html` is the Lab Review hub. Each exercise has a button. To make a page live, add an `href` to its tile in the `GROUPS` list near the bottom of the file. Tiles without an `href` show as "Coming soon".
- `biochem-tests.html` is the virtual bench for the biochemical tests (MSA, EMB, starch, OF-dextrose, Durham sugar tubes, MR, VP, citrate, gelatin, urease, phenylalanine, peptone iron deep, MIO, nitrate). Each test can be opened directly with a link like `biochem-tests.html#phe`.
- `stains.html` is the staining bench (drag the loop to a culture tube, drag dropper bottles onto the slide, drag the slide through the burner flame): smear preparation and simple stain, Gram stain, and endospore stain. Open a tab directly with `stains.html#smear`, `#gram`, or `#spore`.
- `basics.html` covers Exercises 1 to 4: the microscope, living microorganisms, microbes in the environment, and aseptic technique. Open a tab with `basics.html#scope`, `#living`, `#environment`, or `#aseptic`.
- `metab.css` is the shared stylesheet.
- `drag.js` is the shared drag and drop helper used by the stain bench and the hanging-drop activity (drag an item, or tap it and then tap where it goes).

No build step. Open `index.html` in a browser, or publish the repo with GitHub Pages.
