Front-end

Use the principle of least power when generating code.
Don't use javascript if you can use CSS
Don't use CSS if you can use HTML

Backend

Always favor native node modules over external npm packages:

Examples:
node:test over jest
node --watch-path over nodemon
parseArgs from node:util over commander
