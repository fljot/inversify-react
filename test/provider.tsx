import * as React from 'react';
import 'reflect-metadata';
import { injectable, interfaces, Container } from 'inversify';

import { resolve, Provider } from '../src/index';
import * as renderer from 'react-test-renderer';

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

class RootComponent extends React.Component<{}, {}> {
    constructor(props: any, context: any) {
        super(props, context);

        this.container = new Container();
        this.container.bind(Foo).toSelf();
        this.container.bind(Bar).toSelf();
    }

    private readonly container: interfaces.Container;

    render() {
        return <Provider container={this.container}><div>{this.props.children}</div></Provider>;
    }
}

class ChildComponent extends React.Component<{}, {}> {
    @resolve
    private readonly foo: Foo;

    render() {
        return <div>{this.foo.name}</div>;
    }
}

test('provider provides to immediate children', () => {
    const tree: any = renderer.create(
        <RootComponent>
            <ChildComponent />
        </RootComponent>
    ).toJSON();

    expect(tree.type).toBe('div');
    expect(tree.children[0].type).toBe('div');
    expect(tree.children[0].children).toEqual(['foo']);
});

test('provider provides services to deep children', () => {
    const tree: any = renderer.create(
        <RootComponent>
            <div>
                <ChildComponent />
            </div>
        </RootComponent>
    ).toJSON();

    expect(tree.type).toBe('div');
    expect(tree.children[0].type).toBe('div');
    expect(tree.children[0].children[0].type).toBe('div');
    expect(tree.children[0].children[0].children).toEqual(['foo']);
});

describe('hierarchy of containers', () => {
    test('providers make hierarchy of containers by default', () => {
        const outerContainer = new Container();
        outerContainer.bind(Foo).toSelf();
        const innerContainer = new Container();

        const tree: any = renderer.create(
            <Provider container={outerContainer}>
                <Provider container={innerContainer}>
                    <ChildComponent />
                </Provider>
            </Provider>
        ).toJSON();

        expect(innerContainer.parent).toBe(outerContainer);
        expect(tree.type).toBe('div');
        expect(tree.children).toEqual(['foo']); // value from outer container
    });

    test(`"standalone" provider isolates container`, () => {
        const outerContainer = new Container();
        const innerContainer = new Container();

        renderer.create(
            <Provider container={outerContainer}>
                <Provider container={innerContainer} standalone={true} />
            </Provider>
        ).toJSON();

        expect(innerContainer.parent).toBeNull();
    });
});
