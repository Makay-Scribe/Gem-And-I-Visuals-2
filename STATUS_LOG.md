
## 🔄 Update Workflow FOR AI - please update entire file to match what you think you need to see

### 1. Quick Status Log
At the end of each coding/debugging session, add a short entry under **Known Issues** or **Debugging Notes**:
- **Format:**  
  ```
  [Date] – [File touched] – [Action/Result]
  ```
- **Example:**  
  ```
  Nov 17 – main.js – Adjusted mouse handler, splat still not visible.
  Nov 18 – HydroSimManager.js – Added debug color output, fluid motion confirmed.
  ```

### 2. Success Criteria Check
When a milestone task is complete, mark it with a ✅ in the **Success Criteria** section.  
- Example:  
  ```
  ✅ Mouse splatting adds visible color to HydroSim canvas.
  ```

### 3. Minimal File Tracking
If you add or modify a file, just append it to the **Progress Tracking Table** with status:
- `Created` → brand new file.  
- `Modified` → existing file updated.  
- `Pending` → planned but not started.  

### 4. AI Review Prompt
Whenever you update, include a note like:  
> “AI: Review roadmap vs repo vs current status. Suggest fixes if mismatched.”  

## 🧠 Why This Works
- **Low effort:** You only add one or two lines per session.  
- **High clarity:** AI sees exactly what changed and what’s still broken.  
- **No drift:** Success Criteria + Progress Table stay aligned with actual repo state.  
- **Creative continuity:** Debugging notes + prompts keep AI aware of both technical and artistic goals.

------------------------->

EXAMPLE:

## 🔄 Update Log (Template)

**Date:** [YYYY‑MM‑DD]  
**Milestone:** [Sandbox / Hello World / Core Fluid Physics / Director Integration / Mid‑Term / Long‑Term]  
**Files touched:**  
- [FileName.js] – [Created/Modified/Pending]  
- [Shader.glsl] – [Created/Modified/Pending]  

**Actions Taken:**  
- [Short description of what you did]  
- [Any debugging attempts]  

**Result:**  
- [Success / Partial Success / Failure]  
- [Observed output, e.g., “Black canvas renders, but splat still invisible”]  

**Next Steps:**  
- [What you plan to try next]  

**AI Review Prompt:**  
> AI: Review roadmap vs repo vs current status. Suggest fixes if mismatched.

---

### Example Entry

```
Date: 2025-11-17
Milestone: Core Fluid Physics
Files touched:
- main.js – Modified
- HydroSimManager.js – Modified
- splat.glsl – Created
Actions Taken:
- Added mouse input handling for splat.
- Tried exclusive return; in main.js.
Result:
- Failure: Black canvas renders, but splat not visible.
Next Steps:
- Separate event channels for camera vs HydroSimManager.
AI Review Prompt:
> AI: Review roadmap vs repo vs current status. Suggest fixes if mismatched.


--------------------------->
