import * as React from 'react';
import { useState } from 'react';
import 'reflect-metadata';
import { injectable, Container } from 'inversify';
import * as renderer from 'react-test-renderer';

import { resolve, Provider } from '../src';

@injectable()
class Foo { 
    get name() {
        return 'foo';
    }
}

@injectable()
class Bar {
    get name() {
        return 'bar';
    }
}

const RootComponent: React.FC = ({ children }) => {
    const [container] = useState(() => {
        const c = new Container();
        c.bind(Foo).toSelf();
        c.bind(Bar).toSelf();
        return c;
    });
    return (
        <Provider container={container}>
            <div>{children}</div>
        </Provider>
    );
};

test('resolve using reflect metadata', () => {
    class ChildComponent extends React.Component<{}, {}> {
        @resolve
        private readonly foo: Foo;

        render() {
            return <div>{this.foo.name}</div>;
        }
    }

    const tree: any = renderer.create(
        <RootComponent>
            <ChildComponent />
        </RootComponent>
    ).toJSON();

    expect(tree.type).toBe('div');
    expect(tree.children[0].type).toBe('div');
    expect(tree.children[0].children).toEqual(['foo']);
});

test('resolve using service identifier (string)', () => {
    const container = new Container();
    container.bind("FooFoo").to(Foo);

    class ChildComponent extends React.Component<{}, {}> {
        @resolve("FooFoo")
        private readonly foo: any;

        render() {
            return <div>{this.foo.name}</div>;
        }
    }

    const tree: any = renderer.create(
        <Provider container={container}>
            <ChildComponent />
        </Provider>
    ).toJSON();

    expect(tree.type).toBe('div');
    expect(tree.children).toEqual(['foo']);
});

test('resolve using service identifier (symbol)', () => {
    const identifier = Symbol();

    const container = new Container();
    container.bind(identifier).to(Foo);

    class ChildComponent extends React.Component<{}, {}> {
        @resolve(identifier)
        private readonly foo: any;

        render() {
            return <div>{this.foo.name}</div>;
        }
    }

    const tree: any = renderer.create(
        <Provider container={container}>
            <ChildComponent />
        </Provider>
    ).toJSON();

    expect(tree.type).toBe('div');
    expect(tree.children).toEqual(['foo']);
});

test('resolve using service identifier (newable)', () => {
    class ChildComponent extends React.Component<{}, {}> {
        @resolve(Foo)
        private readonly foo: any;

        render() {
            return <div>{this.foo.name}</div>;
        }
    }

    const tree: any = renderer.create(
        <RootComponent>
            <ChildComponent />
        </RootComponent>
    ).toJSON();

    expect(tree.type).toBe('div');
    expect(tree.children[0].type).toBe('div');
    expect(tree.children[0].children).toEqual(['foo']);
});

test('resolve optional using reflect metadata', () => {
    const container = new Container();
    container.bind(Foo).toSelf();

    class ChildComponent extends React.Component<{}, {}> {
        @resolve.optional
        private readonly foo?: Foo;

        @resolve.optional
        private readonly bar?: Bar;

        render() {
            return <div>{this.foo && this.foo.name}{this.bar && this.bar.name}</div>;
        }
    }

    const tree: any = renderer.create(
        <Provider container={container}>
            <ChildComponent />
        </Provider>
    ).toJSON();

    expect(tree.type).toBe('div');
    expect(tree.children).toEqual(['foo']);
});

test('resolve optional using service identifier (string)', () => {
    const container = new Container();
    container.bind("FooFoo").to(Foo);

    class ChildComponent extends React.Component<{}, {}> {
        @resolve.optional("FooFoo")
        private readonly foo: any;

        @resolve.optional("BarBAr")
        private readonly bar: any;

        render() {
            return <div>{this.foo && this.foo.name}{this.bar && this.bar.name}</div>;
        }
    }

    const tree: any = renderer.create(
        <Provider container={container}>
            <ChildComponent />
        </Provider>
    ).toJSON();

    expect(tree.type).toBe('div');
    expect(tree.children).toEqual(['foo']);
});

test('resolve optional using service identifier (symbol)', () => {
    const fooIdentifier = Symbol();
    const barIdentifier = Symbol();

    const container = new Container();
    container.bind(fooIdentifier).to(Foo);

    class ChildComponent extends React.Component<{}, {}> {
        @resolve.optional(fooIdentifier)
        private readonly foo: any;

        @resolve.optional(barIdentifier)
        private readonly bar: any;

        render() {
            return <div>{this.foo && this.foo.name}{this.bar && this.bar.name}</div>;
        }
    }

    const tree: any = renderer.create(
        <Provider container={container}>
            <ChildComponent />
        </Provider>
    ).toJSON();

    expect(tree.type).toBe('div');
    expect(tree.children).toEqual(['foo']);
});

test('resolve optional using service identifier (newable)', () => {
    const container = new Container();
    container.bind(Foo).toSelf();

    class ChildComponent extends React.Component<{}, {}> {
        @resolve.optional(Foo)
        private readonly foo: any;

        @resolve.optional(Bar)
        private readonly bar: any;

        render() {
            return <div>{this.foo && this.foo.name}{this.bar && this.bar.name}</div>;
        }
    }

    const tree: any = renderer.create(
        <Provider container={container}>
            <ChildComponent />
        </Provider>
    ).toJSON();

    expect(tree.type).toBe('div');
    expect(tree.children).toEqual(['foo']);
});
