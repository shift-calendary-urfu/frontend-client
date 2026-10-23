import { configure } from "@testing-library/react";

// Allow chained React/API updates on slower developer machines and CI workers.
configure({ asyncUtilTimeout: 3000 });
