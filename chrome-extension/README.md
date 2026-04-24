# Dynamic Rounding - Chrome Extension

This extension allows users to apply the `ROUND_DYNAMIC` algorithm to arbitrary HTML tables on any website via a right-click context menu.

## Architecture Notes

### Safe DOM Text Replacement (The "Wikipedia Problem")

When updating numbers in an HTML table, a naive approach is to read `cell.innerText`, perform the rounding, and write back `cell.innerText = new_value`. However, this approach destroys any child HTML tags within the `<td>`.

During the development of this extension, we encountered a specific edge case common on data-heavy sites like Wikipedia. When extracting text and attempting to inject the rounded values back into the DOM, we found that tables often use **multiple invisible blocks or spans** to construct a single visual number. 

#### Why Sites Do This:
1. **Decimal Alignment:** To ensure that numbers align perfectly on their decimal points, a site might wrap the integer part, the decimal point, and the fractional part in separate `<span>` elements with specific CSS widths, visibilities, or text alignments.
   *Example:* `<span>+2</span><span style="visibility:hidden">.</span><span>5%</span>`
2. **Hidden Sort Keys:** Tables often embed machine-readable sort values directly alongside the visual text using `display: none` or hidden spans so that the table sorts correctly when a user clicks the column header.
   *Example:* `<span class="sortkey" style="display:none">700023000</span>+2.3%`

#### The Solution: Multi-Node Text Replacement
If a script naively overwrites the `innerText` when it fails to find a single clean text node to replace, it wipes out these structural spans. This leads to broken column widths, lost padding, and ruined text colors (since the alignment spans and CSS classes are removed).

To preserve the layout and keep column widths consistent, the extension uses a cross-node replacement algorithm:
1. We traverse the DOM tree of the cell using a `TreeWalker` to extract all `TextNodes`.
2. We concatenate their values into a single string to find the exact start and end indices of the target number.
3. We map those string indices back to the specific `TextNodes` that house the characters.
4. We inject the new rounded number into the first `TextNode` involved in the match and empty the subsequent nodes that contained the rest of the old number.

This guarantees that the structural HTML elements (like the spans dictating width, color, or alignment) are left completely untouched, preventing the table columns from resizing or breaking.
