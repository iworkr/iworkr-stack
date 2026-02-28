# Workflow — Screenshot Loop (UI Verification)

> Use this workflow to iterate UI to premium quality quickly.

## Prerequisites
- `pnpm dev` running (localhost:3000)
- `docs/STYLE_GUIDE.md` loaded as reference
- Reference screenshots or designs identified (if any)

## Loop steps

### Round 1 — Structural check
1. Navigate to the affected screen(s).
2. Capture screenshots at these breakpoints:
   - **Desktop**: 1440px wide
   - **Tablet**: 768px wide
   - **Mobile**: 375px wide
3. Check against `docs/STYLE_GUIDE.md`:
   - [ ] Correct background color (`#050505` dark / `#f9fafb` light)?
   - [ ] Correct surface colors for cards and panels?
   - [ ] Signal Green used only for accents (≤10%)?
   - [ ] Typography hierarchy clear (display → heading → body → caption)?
   - [ ] Spacing follows scale (4/8/12/16/24/32/48/64)?
   - [ ] Border radius follows scale (xs/sm/md/lg/xl)?
4. Fix the top 3 structural issues.

### Round 2 — Detail polish
1. Re-capture screenshots.
2. Check:
   - [ ] Alignment: are elements on a consistent grid?
   - [ ] Text contrast: meets WCAG AA?
   - [ ] Focus states: visible on keyboard navigation?
   - [ ] Loading states: shimmer skeletons present?
   - [ ] Empty states: Lottie or appropriate placeholder?
   - [ ] Hover states: subtle and consistent?
   - [ ] Animations: correct easing and duration?
3. Fix the top 3 detail issues.

### Round 3 — Final check (if needed)
1. Re-capture screenshots.
2. Compare to reference designs.
3. Check cross-browser if relevant.
4. Verify dark + light theme both work.
5. Sign off or note remaining issues as `INCOMPLETE:TODO`.

## Output
```markdown
## Screenshot loop: [Screen name]

### Round 1
- Issue 1: [description] → Fixed
- Issue 2: [description] → Fixed
- Issue 3: [description] → Fixed

### Round 2
- Issue 1: [description] → Fixed
- Issue 2: [description] → Fixed

### Round 3 (if needed)
- All clear / [remaining issues noted as INCOMPLETE:TODO]

### Final verdict
PASS / NEEDS ANOTHER ROUND / INCOMPLETE:TODO items noted
```

## Rules
- **Max 3 rounds** unless the user requests more.
- Don't chase perfection on minor alignment issues — ship quality, not pixel-perfection.
- Focus on what the user will actually notice: spacing, hierarchy, contrast, responsiveness.
