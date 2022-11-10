import { DocsApp } from "codedocs"
import React from "react"
import { render } from "react-dom"
import * as HomeDocs from "./Home.docs"
import * as UseOrderableListDocs from "~/useOrderableList.docs"

render(
  <DocsApp
    logo="React Headless Accessible Hooks"
    docs={[HomeDocs, UseOrderableListDocs]}
  />,
  document.getElementById("root")
)
