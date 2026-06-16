# Forms

Forms collect input. The shorter the form, the more people finish it.

## Validation

Validate on submit, not on every keystroke. Show errors next to the field they
belong to, in plain language:

- Good: "Enter an email address like name@example.com"
- Bad: "Invalid input (code 422)"

## Submission

Disable the submit button while a request is in flight and restore it on
completion. Never leave the user guessing whether their click registered.
