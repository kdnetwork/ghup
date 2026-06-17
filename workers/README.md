# server

use Cloudflare workers

## ⚠️ Warning

**Never** use Cloudflare workers to run **public** GitHub proxy instances

Your domain and Cloudflare account will be **reported and suspended** by relevant individuals or companies

## Vars

| Var         | Default | Description                               |
| :---------- | :------ | :---------------------------------------- |
| SECRET_PATH | `''`    | A path between host and real path         |
| REPOS       | `[]`    | An array json, find more from `~/rule.ts` |

- edit `REPOS` in the [online editor](https://www.typescriptlang.org/play/?#code/PTAEGsBMDsFMBcDuB7ATuYBzAFgWgA6rIAeAnqKgK4A2sosxAhgLb60BQIoAxsq7fDoA3RqgCWjAEa1QAA1Sx8yAM6zQ8bLGg9qY7uDkAlStFkAaHsnzkNdBcprxQAK2XJtjZXK1CAdIYBRAAUAeQBlWXYRVApFFQAuUEM4gElBZgBtAF1QAF5QDPZQYtAAbyKSyugWWGV8Rm5YRIByKDgkNAwcAiIyZrMKyuK2RngAMzRmFswxDUpJfsGhwjERQUSxxmplWAGhkqpaZUTy-f3GfDETpbOhxkoNDa2dvduzoVhxMdJEjNO3gEAMTEsGokBalB2qAA+oxMFp4IsAQCQvhPqM0C1lPBRPBlNDELNsEjkbcAGpbShNUCtGAIFDoLDYSj4XAszCoRiQT7NG7IgC+WT5+35wtAosqoqF7F40DctF81GQmAAFM0AMIhIIATVwuAAfAAdaDG5qgADUoAAUmEQgA5XzY8TQGbfFUKJTKACUFppxuNAB49Zqdc0vex2GJoIJUJtGklUukyhVqsxavVGoknVHMBUVmtYAB+RKSZDIWiMaB56ijCaoKY0mZzBYVBqNZT4+DIcBaYugbMuiqHWp9oK4iTUAP-YoZfCgKM0hQVnbKM0AHxpom42FWsHXm8uzSy13OD2wfdL5dglb5Hy+pD7ZM+Ym+xiOfI9NcafeSI0ab9gbIlglcV9QqRBYEkbAy3APtp37WBuAUeAs3gZ1c2KUVRUjaNPjjOgn3vADk2KYFQXBJYN2aShxF5SoqJosRoTGGhqDokoGPEaF6g0djik4piAEcqVQUhoQHTA+NAKjeG7EEpJk5ATDQ0gFJpaDsTU5oxHwLSFDGT4eUomlIU+WF4WjLTiGYtBEFEblIBs1B2NRdEu1QeJjOafVci0-UtN8ryAy0gNAvomlZRxKNVy87FcXxQleK8rRIASoktKjPTYHhYh2LtZB4AvMsKyrYoKWoKlUPQ9hsPgUg0VAQiX1IACvHyFUmtfGg6A3TqWu67IvSAnCY3whMcuI-4ABV6upZoFBy9ix3gGNoCqnMKkBGtMGUPsJM2ohmD7OA7wqKbkHWwdsKjUaGjoX8v1gADiBI0AZrRFpPzu-d5sUR7YWoNiDr4S6MLei7+zQjbimW1bjtgU7SO23bEhOz4aojOqGoeu7iPyZIJu66SEz-J7uuIIA)

