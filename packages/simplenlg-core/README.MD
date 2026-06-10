#simplenlg-core
[SimpleNLG](https://github.com/simplenlg/simplenlg) ported to TypeScript

In an ideal world this library would get a full rewrite and switch to a composition based approach, which would make this much more type safe. However in the world of LLMs (with their high accuracy and still dramatically decreasing computational costs) this may not be worth doing ever.

Things to note:

1. It inconsistently uses a factory to create elements or direct calls to constructors (which have been wrapped into a static method here to better support constructor overloads which are poorly supported in TS/JS).
1. It creates elements in incomplete states. Ideally we use the factory to create them in the right state always
1. It has plently of two-way (parent-child) relationships, but there are not strict mechanisms in place to ensure consistency and instead relies on programmers to make the right choices.
1. It returns the source element as a realisation.
1. A mixture of different programming paradigms to achieve similar functionality across different word categories.
1. some functions silently do nothing

I would strongly suggest a functional rewrite, where data is kept in objects, and functions modify these objects, updating their type throughout the process.
