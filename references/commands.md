# GeoGebra Command Reference

This file lists the commands that are commonly needed by the skill. Use English command names regardless of UI language.

## Golden Rules

| Bad | Good | Reason |
| --- | --- | --- |
| `Kreis((0,0),2)` | `O = (0, 0)` then `Circle(O, 2)` | API command names are English and construction inputs should be named. |
| `2cos(t)` | `2*cos(t)` | Multiplication must be explicit. |
| `a x` | `a*x` | Spaces are not multiplication. |
| `ax` | `a*x` | `ax` is one variable name. |
| `sin(30)` | `sin(30°)` or `sin(30*pi/180)` | Trig functions use radians. |
| `SetColor(P,30,136,229)` | `SetColor(P, "#1E88E5")` | Command RGB values are 0-1, not 0-255. |

## Sliders

```geogebra
t = Slider(0, 2*pi, 0.02, 1, 200, false, true, true, false)
```

Parameter order:

```text
Slider(min, max, step, speed, width, isAngle, horizontal, animating, random)
```

The eighth parameter must be `true` when exported `.ggb` files should preserve animation state.

## Points and Coordinates

```geogebra
O = (0, 0)
P = (2*cos(t), 2*sin(t))
Q = (x(P), 0)
```

Useful coordinate functions:

```geogebra
x(P)
y(P)
```

## Lines, Segments, and Vectors

```geogebra
A = (0, 0)
B = (2, 1)
s = Segment(A, B)
l = Line(A, B)
r = Ray(A, B)
v = Vector(A, B)
```

For desktop-stable `.ggb` export, pass named objects into construction commands. Avoid inline point arguments inside commands:

```geogebra
Bad:  s = Segment((x0, 0), T)
Good: X0 = (x0, 0)
Good: s = Segment(X0, T)
```

## Circles and Arcs

```geogebra
O = (0, 0)
c = Circle(O, 2)
c2 = Circle(A, B)
c3 = Circle(A, B, C)
arc = CircularArc(O, A, B)
sector = CircularSector(O, A, B)
```

## Polygons and Measurements

```geogebra
tri = Polygon(A, B, C)
poly = Polygon(A, B, C, D)
area = Area(tri)
perimeter = Perimeter(tri)
```

## Centers and Construction Helpers

```geogebra
M = Midpoint(A, B)
G = Centroid(tri)
bis = PerpendicularBisector(A, B)
perp = PerpendicularLine(P, l)
parallel = Line(P, v)
```

If a named center command is unavailable in a target app, compute coordinates explicitly:

```geogebra
G = ((x(A) + x(B) + x(C))/3, (y(A) + y(B) + y(C))/3)
```

## Transformations

```geogebra
B = Rotate(A, t, O)
C = Translate(A, v)
D = Reflect(A, l)
E = Dilate(A, 1 + 0.3*sin(t), O)
```

## Functions

```geogebra
f(x) = sin(x)
g(x) = a*x^2 + b*x + c
df(x) = Derivative(f)
P = (t, f(t))
```

For explicit derivatives, direct formulas are often more reliable:

```geogebra
f(x) = 0.12*x^3 - 0.45*x + 1.8
df(x) = 0.36*x^2 - 0.45
q(x) = f(t) + df(t)*(x - t)
```

## Curves and Loci

```geogebra
path = Curve(cos(u), sin(2*u), u, 0, 2*pi)
locus = Locus(Q, P)
```

## Calculus

```geogebra
df(x) = Derivative(f)
area = Integral(f, -2, t)
```

## Sequences

```geogebra
pts = Sequence((cos(k), sin(k)), k, 0, 2*pi, pi/6)
P0 = (0, 0)
P1 = (cos(t), sin(t))
P2 = (cos(t + pi/3), sin(t + pi/3))
s1 = Segment(P0, P1)
s2 = Segment(P0, P2)
```

## Conditional Objects

```geogebra
P = If(t < 1, (t, 0), (1, t - 1))
```

## Styling

Put style commands after object creation so style is saved into `.ggb`.

```geogebra
SetColor(P, "#1E88E5")
SetPointSize(P, 6)
SetPointStyle(P, 0)
SetLineThickness(s, 4)
SetLineStyle(s, 1)
SetFilling(poly, 0.3)
ShowLabel(P, true)
SetLabelMode(P, 1)
SetCaption(P, "point P")
SetTrace(P, true)
```

Line style values are GeoGebra-specific. Common values:

- `0`: solid
- `1`: long dashed
- `2`: short dashed

## View and Background

The harness sets most view options through the JS API. Commands can still be useful:

```geogebra
SetAxesRatio(1, 1)
SetBackgroundColor("#FBFCFE")
```

## Animation Helpers

```geogebra
StartAnimation(t)
SetValue(t, 0)
```

The harness normally uses JS API methods for playback:

- `setAnimating(name, true)`
- `setAnimationSpeed(name, speed)`
- `startAnimation()`
- `stopAnimation()`

## App Compatibility

This skill verifies GeoGebra Classic 6 only. Use `app: "classic"` and keep native geometry commands such as `Circle`, `Segment`, `Polygon`, `Rotate`, and `Midpoint` when the construction needs them.

## Validation Strategy

1. Run `node bin/ggb-anim.mjs validate <scene>`.
2. Run `node bin/ggb-anim.mjs check <scene>` when Playwright is available.
3. If a command fails in preview, check command name, explicit multiplication, dependency order, and Classic 6 compatibility.
