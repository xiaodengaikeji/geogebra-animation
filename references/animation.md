# Animation Recipes

Use one clock slider, usually named `t`, and define everything else as a function of `t`.

```geogebra
t = Slider(0, 2*pi, 0.02, 1, 200, false, true, true, false)
```

The eighth parameter is `animating`; keep it `true` when the exported `.ggb` should preserve animation state.

## 1. Point on a Curve

```geogebra
O = (0, 0)
P = (2*cos(t), 2*sin(t))
r = Segment(O, P)
SetTrace(P, true)
```

## 2. Moving Geometry

```geogebra
A = (2*cos(t), 1.2*sin(t))
B = (2*cos(t + 2*pi/3), 1.2*sin(t + 2*pi/3))
C = (2*cos(t + 4*pi/3), 1.2*sin(t + 4*pi/3))
tri = Polygon(A, B, C)
G = ((x(A) + x(B) + x(C))/3, (y(A) + y(B) + y(C))/3)
```

## 3. Function Family

```geogebra
a = -1 + 0.5*sin(t)
f(x) = a*x^2 + 1
P = (1, f(1))
```

## 4. Tangent and Derivative

```geogebra
f(x) = 0.12*x^3 - 0.45*x + 1.8
df(x) = 0.36*x^2 - 0.45
P = (t, f(t))
q(x) = f(t) + df(t)*(x - t)
```

## 5. Integral Sweep

```geogebra
f(x) = sin(x) + 1.5
area = Integral(f, 0, t)
P = (t, f(t))
```

## 6. Trace and Locus

```geogebra
P = (cos(t), sin(2*t))
SetTrace(P, true)
```

For geometric loci, use `Locus(Q, P)` when `Q` depends on moving point `P`.

## 7. Repeated Objects

```geogebra
P0 = (0, 0)
P1 = (cos(t), sin(t))
P2 = (cos(t + pi/3), sin(t + pi/3))
s1 = Segment(P0, P1)
s2 = Segment(P0, P2)
```

## 8. Manual Timeline

GeoGebra animation is native and uniform. For staged motion, use `If`:

```geogebra
T = Slider(0, 3, 0.02, 1, 200, false, true, true, false)
P = If(T < 1, (T, 0), If(T < 2, (1, 0), (1, T - 2)))
```

## Multiple Sliders

`animate` can contain multiple slider targets, but a single clock slider is easier to reason about and export.
