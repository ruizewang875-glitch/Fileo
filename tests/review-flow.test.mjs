import test from 'node:test';
import assert from 'node:assert/strict';
import {getSessionSummary, nextPendingIndex, adjacentReviewIndex, validReturnRoute} from '../dist/review-flow.js';

const files = [
 {id:'a', decision:'keep'}, {id:'b', decision:'pending'},
 {id:'c', decision:'archive'}, {id:'d', decision:'pending'},
 {id:'outside', decision:'pending'}
];

test('scoped session excludes unrelated files and counts each valid ID once', () => {
 const review = {ids:['a','b','b','missing','c'], cursor:1, deferred:[]};
 assert.deepEqual(getSessionSummary(review, files), {total:3, reviewed:2, deferred:0, remaining:1, complete:false});
 assert.equal(nextPendingIndex(review, files, 2), 1);
});

test('deferring the last pending file completes this session without a file decision', () => {
 const review = {ids:['b'], cursor:0, deferred:['b']};
 assert.deepEqual(getSessionSummary(review, files), {total:1, reviewed:0, deferred:1, remaining:0, complete:true});
 assert.equal(nextPendingIndex(review, files), 1);
 assert.equal(files.find(f => f.id === 'b').decision, 'pending');
});

test('deferred IDs only count while the file remains pending and in scope', () => {
 const review = {ids:['a','b','c'], cursor:0, deferred:['a','b','outside','missing']};
 assert.deepEqual(getSessionSummary(review, files), {total:3, reviewed:2, deferred:1, remaining:0, complete:true});
});

test('next pending follows scope order, then wraps without selecting deferred work', () => {
 const review = {ids:['a','b','c','d'], cursor:1, deferred:[]};
 assert.equal(nextPendingIndex(review, files), 3);
 assert.equal(nextPendingIndex(review, files, 3), 1);
 assert.equal(nextPendingIndex({...review, deferred:['d']}, files, 1), 1);
 assert.equal(nextPendingIndex({...review, deferred:['b','d']}, files, 1), 4);
});

test('previous and next revisit decided files and clamp at session edges', () => {
 const review = {ids:['a','b','c','d'], cursor:1};
 assert.equal(adjacentReviewIndex(review, -1), 0);
 assert.equal(adjacentReviewIndex(review, 1), 2);
 assert.equal(adjacentReviewIndex({...review,cursor:0}, -1), 0);
 assert.equal(adjacentReviewIndex({...review,cursor:3}, 1), 3);
 assert.equal(adjacentReviewIndex({...review,cursor:4}, -1), 3);
});

test('empty or removed scopes complete and return the completion index', () => {
 assert.deepEqual(getSessionSummary({ids:[], deferred:[]}, files), {total:0, reviewed:0, deferred:0, remaining:0, complete:true});
 assert.equal(nextPendingIndex({ids:[], cursor:0}, files), 0);
 assert.equal(adjacentReviewIndex({ids:[], cursor:0}, -1), 0);
 assert.equal(nextPendingIndex({ids:['missing'], cursor:0}, files), 1);
 assert.equal(getSessionSummary({ids:['missing']}, files).total, 0);
});

test('safe return routes retain file filters and canonicalize home', () => {
 assert.equal(validReturnRoute('#files?project=Nora%20furniture&bucket=undecided&q=chair'), '#files?project=Nora+furniture&bucket=undecided&q=chair');
 assert.equal(validReturnRoute('#dashboard?metric=space&bucket=trash'), '#dashboard?bucket=trash&metric=space');
 assert.equal(validReturnRoute('#home'), '#');
 assert.equal(validReturnRoute('#activity'), '#activity');
});

test('return route rejects external and transient destinations and drops route injection', () => {
 for (const target of ['https://example.com', '//example.com', '#review', '#analysis', '#import', '#files/../../review', '#files\\review', '#files\n']) assert.equal(validReturnRoute(target), '#files');
 assert.equal(validReturnRoute('#files?page=review&type=psd&redirect=https%3A%2F%2Fexample.com'), '#files?type=psd');
 assert.equal(validReturnRoute('#files?q=%0Asecret&bucket=keep'), '#files?bucket=keep');
 assert.equal(validReturnRoute(null), '#files');
});
