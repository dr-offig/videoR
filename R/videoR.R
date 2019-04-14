#' <Add Title>
#'
#' <Add Description>
#'
#' @import htmlwidgets
#'
#' @export
videoR <- function(videoURL, videoName, videoMarkers, width = NULL, height = NULL, elementId = NULL) {

  # forward options using x
  x = list(
    videoURL = videoURL,
    videoName = videoName,
    videoMarkers = videoMarkers
  )

  # put in some meta tags
  #deps <- list(htmltools::htmlDependency(name="responsive",version=1,src="/",
  #                                    head="<meta name='viewport' content='width=device-width, initial-scale=1.0'>"))

  # create widget
  htmlwidgets::createWidget(
    name = 'videoR',
    x,
    width = width,
    height = height,
    package = 'videoR',
    elementId = elementId
  )
}

#' Shiny bindings for videoR
#'
#' Output and render functions for using videoR within Shiny
#' applications and interactive Rmd documents.
#'
#' @param outputId output variable to read from
#' @param width,height Must be a valid CSS unit (like \code{'100\%'},
#'   \code{'400px'}, \code{'auto'}) or a number, which will be coerced to a
#'   string and have \code{'px'} appended.
#' @param expr An expression that generates a videoR
#' @param env The environment in which to evaluate \code{expr}.
#' @param quoted Is \code{expr} a quoted expression (with \code{quote()})? This
#'   is useful if you want to save an expression in a variable.
#'
#' @name videoR-shiny
#'
#' @export
videoROutput <- function(outputId, width = '100%', height = 'auto'){
  htmlwidgets::shinyWidgetOutput(outputId, 'videoR', width, height, package = 'videoR')
}

#' @rdname videoR-shiny
#' @export
renderVideoR <- function(expr, env = parent.frame(), quoted = FALSE) {
  if (!quoted) { expr <- substitute(expr) } # force quoted
  htmlwidgets::shinyRenderWidget(expr, videoROutput, env, quoted = TRUE)
}
